import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { ScrapeError } from "../../src/lib/errors";
import {
  Fryzigg,
  FryziggConfig,
  FryziggLive,
  RdsParser,
  RdsParserLive,
} from "../../src/sources/fryzigg";
import { FRYZIGG_SNAPSHOTS } from "../../src/sources/fryzigg-snapshots";
import {
  fixtureBytes,
  fixtureHttp,
  type RequestLog,
  requestLog,
  type RouteAnswer,
} from "../support/http";

const FIXTURE_SHA256 = "e41773328a6cd1e926f22a1ed0f54cc18e4d0d21743172bdbde3b2f87843cd58";

const fixtureBuffer = fixtureBytes("fryzigg-sample.rds");

/** The live RDS parser, recording every buffer it is asked to parse. */
function recordingParser(parsed: Uint8Array[]) {
  return Layer.effect(
    RdsParser,
    Effect.gen(function* () {
      const live = yield* RdsParser;

      return {
        parse: (bytes: Uint8Array) => {
          parsed.push(bytes);

          return live.parse(bytes);
        },
      };
    }),
  ).pipe(Layer.provide(RdsParserLive));
}

interface FryziggTestOptions {
  readonly log?: RequestLog;
  readonly sha256?: string | null;
  readonly parsed?: Uint8Array[];
}

/** The live Fryzigg client answering every request with `answer`. */
function fryziggWith(answer: RouteAnswer, options: FryziggTestOptions = {}) {
  return FryziggLive.pipe(
    Layer.provide(
      Layer.mergeAll(
        fixtureHttp([["fryziggafl.net", answer]], options.log ? { log: options.log } : undefined),
        recordingParser(options.parsed ?? []),
        Layer.succeed(FryziggConfig, { sha256: options.sha256 }),
      ),
    ),
  );
}

describe("Fryzigg", () => {
  it.effect("fetches and parses AFLM RDS file into a DataFrame", () =>
    Effect.gen(function* () {
      const fryzigg = yield* Fryzigg;
      const frame = yield* fryzigg.fetchPlayerStats("AFLM");

      expect(frame.names).toContain("match_id");
      expect(frame.names).toContain("player_id");
      expect(frame.names).toContain("kicks");
      expect(frame.columns.length).toBe(80);
    }).pipe(Effect.provide(fryziggWith({ body: fixtureBuffer }, { sha256: FIXTURE_SHA256 }))),
  );

  it.effect("uses the AFLW URL when competition is AFLW", () => {
    const log = requestLog();

    return Effect.gen(function* () {
      const fryzigg = yield* Fryzigg;

      yield* fryzigg.fetchPlayerStats("AFLW").pipe(Effect.ignore);
      expect(log.urls).toHaveLength(1);
      expect(log.urls[0]).toContain("aflw_player_stats.rds");
    }).pipe(Effect.provide(fryziggWith({ body: fixtureBuffer }, { log, sha256: FIXTURE_SHA256 })));
  });

  it.effect("fails with a ScrapeError for non-OK HTTP response", () =>
    Effect.gen(function* () {
      const fryzigg = yield* Fryzigg;
      const error = yield* fryzigg.fetchPlayerStats("AFLM").pipe(Effect.flip);

      expect(error).toBeInstanceOf(ScrapeError);
      expect(error.message).toContain("404");
    }).pipe(Effect.provide(fryziggWith({ body: "Not Found", status: 404 }))),
  );

  it.effect("fails with a ScrapeError for network failure", () =>
    Effect.gen(function* () {
      const fryzigg = yield* Fryzigg;
      const error = yield* fryzigg.fetchPlayerStats("AFLM").pipe(Effect.flip);

      expect(error).toBeInstanceOf(ScrapeError);
      expect(error.message).toContain("Network unreachable");
    }).pipe(
      Effect.provide(
        fryziggWith({
          respond: () => Promise.reject(new Error("Network unreachable")),
        }),
      ),
    ),
  );

  it.effect("fails with a ScrapeError for invalid RDS data", () =>
    Effect.gen(function* () {
      const fryzigg = yield* Fryzigg;
      const error = yield* fryzigg.fetchPlayerStats("AFLM").pipe(Effect.flip);

      expect(error).toBeInstanceOf(ScrapeError);
      expect(error.source).toBe("fryzigg");
    }).pipe(
      Effect.provide(
        fryziggWith(
          { body: new Uint8Array([0x00, 0x01, 0x02]) },
          { sha256: "ae4b3280e56e2faf83f414a6e3dabe9d5fbe18976544c05fed121accb85b53fc" },
        ),
      ),
    ),
  );

  it.effect("includes User-Agent header in request", () => {
    const log = requestLog();

    return Effect.gen(function* () {
      const fryzigg = yield* Fryzigg;

      yield* fryzigg.fetchPlayerStats("AFLM");
      const headers = new Headers(log.inits[0]?.headers);
      expect(headers.get("User-Agent") ?? "").toContain("fitzRoy-ts");
    }).pipe(Effect.provide(fryziggWith({ body: fixtureBuffer }, { log, sha256: FIXTURE_SHA256 })));
  });

  it.effect("rejects modified bytes before parsing", () => {
    const parsed: Uint8Array[] = [];
    const modified = fixtureBuffer.slice();
    const lastIndex = modified.length - 1;
    const lastByte = modified[lastIndex] ?? 0;
    modified[lastIndex] = lastByte ^ 0x01;

    return Effect.gen(function* () {
      const fryzigg = yield* Fryzigg;
      const error = yield* fryzigg.fetchPlayerStats("AFLM").pipe(Effect.flip);

      expect(error).toBeInstanceOf(ScrapeError);
      expect(error.message).toBe("Fryzigg checksum mismatch for AFLM snapshot");
      expect(error.message).not.toContain(FIXTURE_SHA256);
      expect(parsed).toHaveLength(0);
    }).pipe(Effect.provide(fryziggWith({ body: modified }, { sha256: FIXTURE_SHA256, parsed })));
  });

  it.effect("parses verified bytes exactly once", () => {
    const parsed: Uint8Array[] = [];

    return Effect.gen(function* () {
      const fryzigg = yield* Fryzigg;

      yield* fryzigg.fetchPlayerStats("AFLM");
      expect(parsed).toHaveLength(1);
    }).pipe(
      Effect.provide(fryziggWith({ body: fixtureBuffer }, { sha256: FIXTURE_SHA256, parsed })),
    );
  });

  it.effect("uses the reviewed manifest checksum by default", () =>
    Effect.gen(function* () {
      const fryzigg = yield* Fryzigg;
      const error = yield* fryzigg.fetchPlayerStats("AFLM").pipe(Effect.flip);

      expect(error.message).toBe("Fryzigg checksum mismatch for AFLM snapshot");
      expect(FRYZIGG_SNAPSHOTS.AFLM.sha256).toMatch(/^[a-f0-9]{64}$/);
    }).pipe(Effect.provide(fryziggWith({ body: fixtureBuffer }))),
  );

  it.effect("fails with an explicit error for unsupported competitions", () => {
    const log = requestLog();

    return Effect.gen(function* () {
      const fryzigg = yield* Fryzigg;
      const error = yield* fryzigg.fetchPlayerStats("VFL").pipe(Effect.flip);

      expect(error.message).toContain("does not publish VFL data");
      expect(log.urls).toHaveLength(0);
    }).pipe(Effect.provide(fryziggWith({ body: fixtureBuffer }, { log })));
  });
});
