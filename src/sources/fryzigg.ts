/**
 * Fryzigg RDS client for AFL player statistics.
 *
 * Fryzigg distributes advanced player statistics as static RDS (R Data
 * Serialization) files. There is no query API — the entire dataset must
 * be downloaded and parsed, then filtered client-side.
 *
 * - AFLM: ~685K rows × 80 columns (~11.6 MB compressed)
 * - AFLW: ~9.6K rows × 58 columns
 *
 * @see https://www.fryziggafl.net/
 */

import { type DataFrame, isDataFrame, parseRds, RdsError } from "@jackemcpherson/rds-js";
import { Context, Effect, Layer } from "effect";
import { ScrapeError } from "../lib/errors";
import { readBytes, SourceHttp } from "../lib/http";
import type { CompetitionCode } from "../types";
import { FRYZIGG_SNAPSHOTS } from "./fryzigg-snapshots";

/**
 * Fryzigg only publishes AFLM and AFLW datasets. VFL/VFLW are not available
 * from this source — the public API will return an UnsupportedSourceError
 * for those competitions in the source-adapter refactor (Phase B).
 *
 * Security note (SEC-10): fryziggafl.net does not serve HTTPS (verified
 * 2026-06-10 — TLS connections are refused), so these downloads are
 * plain HTTP and an on-path attacker could substitute content. The default
 * client pins operator-reviewed, trust-on-first-use snapshot digests and
 * rejects substituted bytes before invoking the RDS parser.
 */
const USER_AGENT = "fitzRoy-ts/1.0 (https://github.com/jackemcpherson/fitzRoy-ts)";

/** Message of a thrown value, matching the v6 `cause.message` text. */
function causeMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

/** A failed Fryzigg request, with the v6 message prefix. */
function requestFailed(message: string): ScrapeError {
  return new ScrapeError({ message: `Fryzigg request failed: ${message}`, source: "fryzigg" });
}

/** Fryzigg client configuration. */
export interface FryziggOptions {
  /**
   * Override the manifest's hex-encoded SHA-256 checksum. This supports
   * explicitly trusted mirrors and test fixtures. `null` disables the check
   * and is only for callers who deliberately accept unchecked custom bytes;
   * `undefined` (the default) always uses the reviewed manifest checksum.
   */
  readonly sha256: string | null | undefined;
}

/** Fryzigg configuration, defaulting to the reviewed manifest checksums. */
export const FryziggConfig = Context.Reference<FryziggOptions>("fitzroy/FryziggConfig", {
  defaultValue: () => ({ sha256: undefined }),
});

/**
 * Parses Fryzigg RDS bytes into a column-major data frame.
 *
 * A separate service so tests can observe (or replace) the parser, for
 * example to prove that rejected bytes never reach it.
 */
export class RdsParser extends Context.Service<
  RdsParser,
  {
    /**
     * Parse RDS bytes and require the top-level object to be a data frame.
     *
     * @param bytes - The raw (possibly gzipped) RDS bytes.
     */
    readonly parse: (bytes: Uint8Array) => Effect.Effect<DataFrame, ScrapeError>;
  }
>()("fitzroy/RdsParser") {}

/** The live RDS parser over `parseRds` from `@jackemcpherson/rds-js`. */
export const RdsParserLive = Layer.succeed(RdsParser, {
  parse: (bytes) =>
    Effect.tryPromise({
      try: () => parseRds(bytes),
      catch: (cause) =>
        cause instanceof RdsError
          ? new ScrapeError({
              message: `Fryzigg RDS parse error: ${cause.message}`,
              source: "fryzigg",
            })
          : requestFailed(causeMessage(cause)),
    }).pipe(
      Effect.flatMap((value) =>
        isDataFrame(value)
          ? Effect.succeed(value)
          : Effect.fail(
              new ScrapeError({
                message: "Fryzigg RDS file did not contain a data frame",
                source: "fryzigg",
              }),
            ),
      ),
    ),
});

/** Lower-case hex SHA-256 digest of some bytes. */
function sha256Hex(bytes: Uint8Array<ArrayBuffer>): Effect.Effect<string, ScrapeError> {
  return Effect.tryPromise({
    try: () => crypto.subtle.digest("SHA-256", bytes),
    catch: (cause) => requestFailed(causeMessage(cause)),
  }).pipe(
    Effect.map((digest) =>
      Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(""),
    ),
  );
}

/**
 * Fryzigg RDS client.
 *
 * Downloads and parses static RDS files from fryziggafl.net. The full
 * dataset is always fetched — there is no server-side filtering. Callers
 * should filter the returned DataFrame by season/round before constructing
 * row objects to minimise memory usage.
 */
export class Fryzigg extends Context.Service<
  Fryzigg,
  {
    /**
     * Fetch the full player statistics dataset for a competition.
     *
     * Returns column-major DataFrame from rds-js. The caller is responsible
     * for filtering rows and mapping to domain types.
     *
     * @param competition - AFLM or AFLW.
     */
    readonly fetchPlayerStats: (
      competition: CompetitionCode,
    ) => Effect.Effect<DataFrame, ScrapeError>;
  }
>()("fitzroy/Fryzigg") {}

/** The live Fryzigg client over {@link SourceHttp} and {@link RdsParser}. */
export const FryziggLive = Layer.effect(
  Fryzigg,
  Effect.gen(function* () {
    const http = yield* SourceHttp;
    const parser = yield* RdsParser;
    const config = yield* FryziggConfig;

    return {
      fetchPlayerStats: (competition) =>
        Effect.gen(function* () {
          if (competition !== "AFLM" && competition !== "AFLW") {
            return yield* Effect.fail(
              new ScrapeError({
                message: `Fryzigg does not publish ${competition} data`,
                source: "fryzigg",
              }),
            );
          }

          const snapshot = FRYZIGG_SNAPSHOTS[competition];
          const expectedSha256 = config.sha256 === undefined ? snapshot.sha256 : config.sha256;

          const buffer = yield* Effect.gen(function* () {
            const response = yield* http.request(snapshot.url, {
              headers: { "User-Agent": USER_AGENT },
            });

            if (!response.ok) {
              return yield* Effect.fail(requestFailed(`${response.status} (${snapshot.url})`));
            }

            return yield* readBytes(response);
          }).pipe(
            Effect.catchTag("RequestError", (error) => Effect.fail(requestFailed(error.message))),
          );

          if (expectedSha256 !== null) {
            const actual = yield* sha256Hex(new Uint8Array(buffer));

            if (actual !== expectedSha256.toLowerCase()) {
              return yield* Effect.fail(
                new ScrapeError({
                  message: `Fryzigg checksum mismatch for ${competition} snapshot`,
                  source: "fryzigg",
                }),
              );
            }
          }

          return yield* parser.parse(buffer);
        }),
    };
  }),
);
