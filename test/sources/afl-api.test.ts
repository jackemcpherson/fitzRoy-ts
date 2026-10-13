import { afterEach, describe, expect, it, vi } from "@effect/vitest";
import { Effect, Layer, Schema } from "effect";
import { TestClock } from "effect/testing";
import { AflApiError, ValidationError } from "../../src/lib/errors";
import type { MatchItem } from "../../src/lib/validation";
import { aflApiLineupSource, aflApiPlayerStatsSource } from "../../src/sources/adapters/afl-api";
import { AflApi, AflApiLive } from "../../src/sources/afl-api";
import { fixtureHttp, type RequestLog, requestLog, type Route } from "../support/http";

/** Helper to create a mock Response. */
function mockResponse(body: unknown, init?: ResponseInit): Response {
  const headers = new Headers({ "Content-Type": "application/json" });

  new Headers(init?.headers).forEach((value, key) => headers.set(key, value));

  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    statusText: init?.statusText ?? "OK",
    headers,
  });
}

/** Answer successive requests with successive responses; an `Error` rejects the fetch. */
function sequence(...answers: ReadonlyArray<Response | Error>): Route {
  const queue = [...answers];

  return [
    /./,
    {
      respond: () => {
        const next = queue.shift();

        if (next === undefined) return new Response("exhausted", { status: 404 });

        return next instanceof Error ? Promise.reject(next) : next;
      },
    },
  ];
}

/** Answer each request from a URL-dispatching function. */
function byUrl(respond: (url: string) => Response | Promise<Response>): Route {
  return [/./, { respond }];
}

/** The live AFL API client over fixture routes. */
function aflApiWith(routes: readonly Route[], log?: RequestLog) {
  return AflApiLive.pipe(Layer.provide(fixtureHttp(routes, log ? { log } : undefined)));
}

/** Standard valid token response. */
const VALID_TOKEN = {
  token: "test-token-123",
  disclaimer: "Test disclaimer",
};

describe("AflApi", () => {
  describe("authenticate", () => {
    it.effect("returns access token on success", () => {
      const log = requestLog();

      return Effect.gen(function* () {
        const client = yield* AflApi;

        const token = yield* client.authenticate;

        expect(token).toBe("test-token-123");
        expect(log.urls).toHaveLength(1);
        expect(log.urls[0]).toBe("https://api.afl.com.au/cfs/afl/WMCTok");
        expect(log.inits[0]?.method).toBe("POST");
        const headers = new Headers(log.inits[0]?.headers);
        expect(headers.get("Content-Length")).toBe("0");
        expect(headers.get("User-Agent")).toContain("fitzroy");
      }).pipe(Effect.provide(aflApiWith([sequence(mockResponse(VALID_TOKEN))], log)));
    });

    it.effect("caches the token so isAuthenticated returns true", () =>
      Effect.gen(function* () {
        const client = yield* AflApi;

        expect(yield* client.isAuthenticated).toBe(false);
        yield* client.authenticate;
        expect(yield* client.isAuthenticated).toBe(true);
      }).pipe(Effect.provide(aflApiWith([sequence(mockResponse(VALID_TOKEN))]))),
    );

    it.effect("fails on non-OK response", () =>
      Effect.gen(function* () {
        const client = yield* AflApi;

        const error = yield* Effect.flip(client.authenticate);

        expect(error).toBeInstanceOf(AflApiError);
        expect(error.statusCode).toBe(500);
        expect(error.message).toBe("Token request failed: 500");
      }).pipe(
        Effect.provide(
          aflApiWith([
            sequence(mockResponse({}, { status: 500, statusText: "Internal Server Error" })),
          ]),
        ),
      ),
    );

    it.effect("fails on invalid token format", () =>
      Effect.gen(function* () {
        const client = yield* AflApi;

        const error = yield* Effect.flip(client.authenticate);

        expect(error).toBeInstanceOf(AflApiError);
        expect(error.message).toContain("Invalid token response format");
      }).pipe(Effect.provide(aflApiWith([sequence(mockResponse({ invalid: true }))]))),
    );

    it.effect("fails on network failure", () =>
      Effect.gen(function* () {
        const client = yield* AflApi;

        const error = yield* Effect.flip(client.authenticate);

        expect(error.message).toBe("Token request failed: Network unreachable");
      }).pipe(Effect.provide(aflApiWith([sequence(new Error("Network unreachable"))]))),
    );

    it.effect("shares one in-flight token request between concurrent callers", () => {
      const log = requestLog();

      return Effect.gen(function* () {
        const client = yield* AflApi;

        const tokens = yield* Effect.all(
          [
            client.fetchJson("https://api.afl.com.au/a", Schema.Struct({})),
            client.fetchJson("https://api.afl.com.au/b", Schema.Struct({})),
            client.fetchJson("https://api.afl.com.au/c", Schema.Struct({})),
          ],
          { concurrency: "unbounded" },
        );

        expect(tokens).toHaveLength(3);
        expect(log.urls.filter((url) => url.includes("WMCTok"))).toHaveLength(1);
      }).pipe(
        Effect.provide(
          aflApiWith(
            [
              byUrl((url) =>
                url.includes("WMCTok") ? mockResponse(VALID_TOKEN) : mockResponse({}),
              ),
            ],
            log,
          ),
        ),
      );
    });

    it.effect("reuses the token for 30 minutes, then fetches a new one", () => {
      const log = requestLog();

      return Effect.gen(function* () {
        const client = yield* AflApi;
        const schema = Schema.Struct({});

        yield* client.fetchJson("https://api.afl.com.au/a", schema);
        yield* TestClock.adjust("29 minutes");
        yield* client.fetchJson("https://api.afl.com.au/b", schema);
        expect(log.urls.filter((url) => url.includes("WMCTok"))).toHaveLength(1);

        yield* TestClock.adjust("2 minutes");
        expect(yield* client.isAuthenticated).toBe(false);
        yield* client.fetchJson("https://api.afl.com.au/c", schema);
        expect(log.urls.filter((url) => url.includes("WMCTok"))).toHaveLength(2);
      }).pipe(
        Effect.provide(
          aflApiWith(
            [
              byUrl((url) =>
                url.includes("WMCTok") ? mockResponse(VALID_TOKEN) : mockResponse({}),
              ),
            ],
            log,
          ),
        ),
      );
    });

    it.effect("does not cache a failed token request", () =>
      Effect.gen(function* () {
        const client = yield* AflApi;

        yield* Effect.flip(client.authedFetch("https://api.afl.com.au/test"));
        const response = yield* client.authedFetch("https://api.afl.com.au/test");

        expect(response.status).toBe(200);
      }).pipe(
        Effect.provide(
          aflApiWith([
            sequence(
              mockResponse({}, { status: 500, statusText: "Internal Server Error" }),
              mockResponse(VALID_TOKEN),
              mockResponse({ data: "test" }),
            ),
          ]),
        ),
      ),
    );
  });

  describe("authedFetch", () => {
    it.effect("authenticates automatically if not already authenticated", () => {
      const log = requestLog();

      return Effect.gen(function* () {
        const client = yield* AflApi;

        yield* client.authedFetch("https://api.afl.com.au/test");

        expect(log.urls).toHaveLength(2);
      }).pipe(
        Effect.provide(
          aflApiWith([sequence(mockResponse(VALID_TOKEN), mockResponse({ data: "test" }))], log),
        ),
      );
    });

    it.effect("adds x-media-mis-token header to request", () => {
      const log = requestLog();

      return Effect.gen(function* () {
        const client = yield* AflApi;

        yield* client.authedFetch("https://api.afl.com.au/test");

        const headers = new Headers(log.inits[1]?.headers);
        expect(headers.get("x-media-mis-token")).toBe("test-token-123");
        expect(headers.get("User-Agent")).toContain("fitzroy");
      }).pipe(
        Effect.provide(
          aflApiWith([sequence(mockResponse(VALID_TOKEN), mockResponse({ data: "test" }))], log),
        ),
      );
    });

    it.effect("retries once on 401 by re-authenticating", () => {
      const log = requestLog();
      const freshToken = { ...VALID_TOKEN, token: "refreshed-token" };

      return Effect.gen(function* () {
        const client = yield* AflApi;

        yield* client.authedFetch("https://api.afl.com.au/test");

        expect(log.urls).toHaveLength(4);
        expect(new Headers(log.inits[3]?.headers).get("x-media-mis-token")).toBe("refreshed-token");
      }).pipe(
        Effect.provide(
          aflApiWith(
            [
              sequence(
                mockResponse(VALID_TOKEN),
                mockResponse({}, { status: 401, statusText: "Unauthorized" }),
                mockResponse(freshToken),
                mockResponse({ data: "success" }),
              ),
            ],
            log,
          ),
        ),
      );
    });

    it.effect("fails if re-authentication on 401 fails", () =>
      Effect.gen(function* () {
        const client = yield* AflApi;

        const error = yield* Effect.flip(client.authedFetch("https://api.afl.com.au/test"));

        expect(error.message).toBe("Token request failed: 500");
      }).pipe(
        Effect.provide(
          aflApiWith([
            sequence(
              mockResponse(VALID_TOKEN),
              mockResponse({}, { status: 401, statusText: "Unauthorized" }),
              mockResponse({}, { status: 500, statusText: "Internal Server Error" }),
            ),
          ]),
        ),
      ),
    );

    it.effect("fails on non-OK response that is not 401", () =>
      Effect.gen(function* () {
        const client = yield* AflApi;

        const error = yield* Effect.flip(client.authedFetch("https://api.afl.com.au/test"));

        expect(error).toBeInstanceOf(AflApiError);
        expect(error.statusCode).toBe(404);
        expect(error.message).toBe("Request failed: 404 Not Found");
      }).pipe(
        Effect.provide(
          aflApiWith([
            sequence(
              mockResponse(VALID_TOKEN),
              mockResponse({}, { status: 404, statusText: "Not Found" }),
            ),
          ]),
        ),
      ),
    );

    it.effect("fails on network failure during fetch", () =>
      Effect.gen(function* () {
        const client = yield* AflApi;

        const error = yield* Effect.flip(client.authedFetch("https://api.afl.com.au/test"));

        expect(error.message).toBe("Request failed: Connection reset");
      }).pipe(
        Effect.provide(
          aflApiWith([sequence(mockResponse(VALID_TOKEN), new Error("Connection reset"))]),
        ),
      ),
    );
  });

  describe("fetchJson", () => {
    const TestSchema = Schema.Struct({ value: Schema.Number });

    it.effect("fetches, parses, and validates JSON against a schema", () =>
      Effect.gen(function* () {
        const client = yield* AflApi;

        const data = yield* client.fetchJson("https://api.afl.com.au/test", TestSchema);

        expect(data).toEqual({ value: 42 });
      }).pipe(
        Effect.provide(
          aflApiWith([sequence(mockResponse(VALID_TOKEN), mockResponse({ value: 42 }))]),
        ),
      ),
    );

    it.effect("fails with ValidationError when response does not match schema", () =>
      Effect.gen(function* () {
        const client = yield* AflApi;

        const error = yield* Effect.flip(
          client.fetchJson("https://api.afl.com.au/test", TestSchema),
        );

        expect(error).toBeInstanceOf(ValidationError);
        expect(error.message).toBe("Response validation failed");
        expect(error instanceof ValidationError && error.issues?.[0]?.path).toBe(
          "https://api.afl.com.au/test",
        );
      }).pipe(
        Effect.provide(
          aflApiWith([sequence(mockResponse(VALID_TOKEN), mockResponse({ wrong: "shape" }))]),
        ),
      ),
    );

    it.effect("fails with AflApiError when fetch fails", () =>
      Effect.gen(function* () {
        const client = yield* AflApi;

        const error = yield* Effect.flip(
          client.fetchJson("https://api.afl.com.au/test", TestSchema),
        );

        expect(error).toBeInstanceOf(AflApiError);
      }).pipe(
        Effect.provide(
          aflApiWith([
            sequence(
              mockResponse(VALID_TOKEN),
              mockResponse({}, { status: 500, statusText: "Internal Server Error" }),
            ),
          ]),
        ),
      ),
    );

    it.effect("fails with AflApiError when response is not valid JSON", () =>
      Effect.gen(function* () {
        const client = yield* AflApi;

        const error = yield* Effect.flip(
          client.fetchJson("https://api.afl.com.au/test", TestSchema),
        );

        expect(error).toBeInstanceOf(AflApiError);
        expect(error.message).toContain("JSON parse failed");
      }).pipe(
        Effect.provide(
          aflApiWith([
            sequence(
              mockResponse(VALID_TOKEN),
              new Response("not json", { status: 200, headers: { "Content-Type": "text/plain" } }),
            ),
          ]),
        ),
      ),
    );

    it.effect("skips authentication for public aflapi.afl.com.au/afl/v2 URLs", () => {
      const log = requestLog();

      return Effect.gen(function* () {
        const client = yield* AflApi;

        yield* client.fetchJson("https://aflapi.afl.com.au/afl/v2/test", TestSchema);

        expect(log.urls).toEqual(["https://aflapi.afl.com.au/afl/v2/test"]);
        const headers = new Headers(log.inits[0]?.headers);
        expect(headers.get("x-media-mis-token")).toBeNull();
        expect(headers.get("User-Agent")).toContain("fitzroy");
      }).pipe(Effect.provide(aflApiWith([sequence(mockResponse({ value: 1 }))], log)));
    });
  });

  describe("resolveCompetitionId", () => {
    it.effect("returns the hardcoded competition ID for each competition", () => {
      const log = requestLog();

      return Effect.gen(function* () {
        const client = yield* AflApi;

        expect(yield* client.resolveCompetitionId("AFLM")).toBe(1);
        expect(yield* client.resolveCompetitionId("AFLW")).toBe(3);
        expect(yield* client.resolveCompetitionId("VFL")).toBe(7);
        expect(yield* client.resolveCompetitionId("VFLW")).toBe(11);
        // Hardcoded map — never hits the network.
        expect(log.urls).toHaveLength(0);
      }).pipe(Effect.provide(aflApiWith([], log)));
    });
  });

  describe("resolveSeasonId", () => {
    it.effect("returns the season ID matching by name containing year", () =>
      Effect.gen(function* () {
        const client = yield* AflApi;

        expect(yield* client.resolveSeasonId(1, 2024)).toBe(62);
      }).pipe(
        Effect.provide(
          aflApiWith([
            sequence(
              mockResponse({
                compSeasons: [
                  { id: 52, name: "2023 Toyota AFL Premiership" },
                  { id: 62, name: "2024 Toyota AFL Premiership" },
                ],
              }),
            ),
          ]),
        ),
      ),
    );

    it.effect("anchors the year — does not match a year embedded in a longer number (COR-10)", () =>
      Effect.gen(function* () {
        const client = yield* AflApi;

        expect(yield* client.resolveSeasonId(1, 2024)).toBe(62);
      }).pipe(
        Effect.provide(
          aflApiWith([
            sequence(
              mockResponse({
                compSeasons: [
                  { id: 52, name: "Festival Cup 12024" },
                  { id: 62, name: "2024 Toyota AFL Premiership" },
                ],
              }),
            ),
          ]),
        ),
      ),
    );

    it.effect("fails when season year is not found", () =>
      Effect.gen(function* () {
        const client = yield* AflApi;

        const error = yield* Effect.flip(client.resolveSeasonId(1, 2024));

        expect(error).toBeInstanceOf(AflApiError);
        expect(error.message).toContain("2024");
      }).pipe(
        Effect.provide(
          aflApiWith([
            sequence(
              mockResponse({ compSeasons: [{ id: 52, name: "2023 Toyota AFL Premiership" }] }),
            ),
          ]),
        ),
      ),
    );

    it.effect("propagates fetch errors", () =>
      Effect.gen(function* () {
        const client = yield* AflApi;

        const error = yield* Effect.flip(client.resolveSeasonId(1, 2024));

        expect(error.message).toBe("Request failed: 500 Server Error");
      }).pipe(
        Effect.provide(
          aflApiWith([sequence(mockResponse({}, { status: 500, statusText: "Server Error" }))]),
        ),
      ),
    );
  });

  describe("resolveRounds", () => {
    it.effect("returns all rounds for a season", () =>
      Effect.gen(function* () {
        const client = yield* AflApi;

        const rounds = yield* client.resolveRounds(73);

        expect(rounds).toHaveLength(2);
        expect(rounds[0]?.roundNumber).toBe(1);
        expect(rounds[1]?.roundNumber).toBe(2);
      }).pipe(
        Effect.provide(
          aflApiWith([
            sequence(
              mockResponse({
                rounds: [
                  {
                    id: 1146,
                    name: "Round 1",
                    roundNumber: 1,
                    utcStartTime: "2024-03-14T06:20:00.000Z",
                  },
                  {
                    id: 1147,
                    name: "Round 2",
                    roundNumber: 2,
                    utcStartTime: "2024-03-21T06:20:00.000Z",
                  },
                ],
              }),
            ),
          ]),
        ),
      ),
    );

    it.effect("returns empty array when no rounds exist", () =>
      Effect.gen(function* () {
        const client = yield* AflApi;

        expect(yield* client.resolveRounds(73)).toHaveLength(0);
      }).pipe(Effect.provide(aflApiWith([sequence(mockResponse({ rounds: [] }))]))),
    );

    it.effect("propagates fetch errors", () =>
      Effect.gen(function* () {
        const client = yield* AflApi;

        const error = yield* Effect.flip(client.resolveRounds(73));

        expect(error).toBeInstanceOf(AflApiError);
      }).pipe(
        Effect.provide(
          aflApiWith([sequence(mockResponse({}, { status: 500, statusText: "Server Error" }))]),
        ),
      ),
    );
  });

  describe("resolveCurrentSeason", () => {
    // Earliest round start is the season's start instant. "Now" is controlled
    // by faking only `Date` so these tests never depend on the real clock.
    afterEach(() => {
      vi.useRealTimers();
    });

    /** Fake the wall clock without touching the scheduler's timers. */
    function setNow(iso: string): void {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date(iso));
    }

    /** Routes that serve the compseasons list then a rounds list. */
    function seasonRoutes(compseasons: unknown, rounds: unknown): Route {
      return byUrl((url) => {
        if (url.includes("compseasons") && url.includes("/rounds")) return mockResponse(rounds);

        if (url.includes("compseasons")) return mockResponse(compseasons);

        return mockResponse({}, { status: 404 });
      });
    }

    it.effect("returns the newest year when its earliest round has already started", () => {
      setNow("2025-06-15T00:00:00.000Z");

      const compseasons = {
        compSeasons: [
          { id: 70, name: "2024 Toyota AFL Premiership" },
          { id: 80, name: "2025 Toyota AFL Premiership" },
        ],
      };

      const rounds = {
        rounds: [
          { id: 1, name: "Round 1", roundNumber: 1, utcStartTime: "2025-03-13T08:30:00.000Z" },
          { id: 2, name: "Round 2", roundNumber: 2, utcStartTime: "2025-03-20T08:30:00.000Z" },
        ],
      };

      return Effect.gen(function* () {
        const client = yield* AflApi;

        expect(yield* client.resolveCurrentSeason("AFLM")).toBe(2025);
      }).pipe(Effect.provide(aflApiWith([seasonRoutes(compseasons, rounds)])));
    });

    it.effect("skips every pre-created future season using each season's start", () => {
      setNow("2025-06-15T00:00:00.000Z");
      const log = requestLog();

      const starts: Record<string, string> = {
        "90": "2024-08-14T08:30:00.000Z",
        "91": "2025-08-14T08:30:00.000Z",
        "92": "2026-08-14T08:30:00.000Z",
      };

      const route = byUrl((url) => {
        const seasonId = /compseasons\/(\d+)\/rounds/.exec(url)?.[1];

        if (seasonId)
          return mockResponse({
            rounds: [{ id: 1, name: "Round 1", roundNumber: 1, utcStartTime: starts[seasonId] }],
          });

        return mockResponse({
          compSeasons: [
            { id: 91, name: "2025 NAB AFLW Season" },
            { id: 90, name: "2024 NAB AFLW Season" },
            { id: 92, name: "2026 NAB AFLW Season" },
          ],
        });
      });

      return Effect.gen(function* () {
        const client = yield* AflApi;

        expect(yield* client.resolveCurrentSeason("AFLW")).toBe(2024);
        expect(log.urls).toHaveLength(4);
      }).pipe(Effect.provide(aflApiWith([route], log)));
    });

    it.effect("fails when no round carries utcStartTime (indeterminate)", () => {
      setNow("2025-06-15T00:00:00.000Z");

      const compseasons = {
        compSeasons: [
          { id: 70, name: "2024 Toyota AFL Premiership" },
          { id: 80, name: "2025 Toyota AFL Premiership" },
        ],
      };

      const rounds = {
        rounds: [
          { id: 1, name: "Round 1", roundNumber: 1 },
          { id: 2, name: "Round 2", roundNumber: 2 },
        ],
      };

      return Effect.gen(function* () {
        const client = yield* AflApi;

        const error = yield* Effect.flip(client.resolveCurrentSeason("AFLM"));

        expect(error).toBeInstanceOf(AflApiError);
        expect(error.message).toBe(
          "Cannot determine season start: no round has utcStartTime (AFLM)",
        );
      }).pipe(Effect.provide(aflApiWith([seasonRoutes(compseasons, rounds)])));
    });

    it.effect("fails when the compseasons fetch fails", () =>
      Effect.gen(function* () {
        const client = yield* AflApi;

        const error = yield* Effect.flip(client.resolveCurrentSeason("AFLM"));

        expect(error).toBeInstanceOf(AflApiError);
      }).pipe(
        Effect.provide(
          aflApiWith([sequence(mockResponse({}, { status: 500, statusText: "Server Error" }))]),
        ),
      ),
    );

    it.effect("fails when the rounds fetch fails", () => {
      const compseasons = {
        compSeasons: [
          { id: 70, name: "2024 Toyota AFL Premiership" },
          { id: 80, name: "2025 Toyota AFL Premiership" },
        ],
      };

      const route = byUrl((url) => {
        if (url.includes("compseasons") && url.includes("/rounds")) {
          return mockResponse({}, { status: 500, statusText: "Server Error" });
        }

        if (url.includes("compseasons")) return mockResponse(compseasons);

        return mockResponse({}, { status: 404 });
      });

      return Effect.gen(function* () {
        const client = yield* AflApi;

        const error = yield* Effect.flip(client.resolveCurrentSeason("AFLM"));

        expect(error).toBeInstanceOf(AflApiError);
      }).pipe(Effect.provide(aflApiWith([route])));
    });
  });

  describe("fetchRoundMatchItems", () => {
    const matchItemsResponse = {
      roundId: "CD_R202501401",
      items: [
        {
          match: {
            matchId: "CD_M20250140101",
            status: "CONCLUDED",
            utcStartTime: "2025-03-13T08:30:00",
            homeTeamId: "CD_T120",
            awayTeamId: "CD_T30",
            homeTeam: { name: "Richmond", teamId: "CD_T120" },
            awayTeam: { name: "Carlton", teamId: "CD_T30" },
          },
          score: {
            status: "CONCLUDED",
            matchId: "CD_M20250140101",
            homeTeamScore: { matchScore: { totalScore: 82, goals: 13, behinds: 4 } },
            awayTeamScore: { matchScore: { totalScore: 69, goals: 9, behinds: 15 } },
          },
          venue: { name: "MCG" },
        },
      ],
    };

    it.effect("returns match items for a round", () =>
      Effect.gen(function* () {
        const client = yield* AflApi;

        const items = yield* client.fetchRoundMatchItems("CD_R202501401");

        expect(items).toHaveLength(1);
        expect(items[0]?.match.matchId).toBe("CD_M20250140101");
      }).pipe(
        Effect.provide(
          aflApiWith([sequence(mockResponse(VALID_TOKEN), mockResponse(matchItemsResponse))]),
        ),
      ),
    );

    it.effect("propagates fetch errors", () =>
      Effect.gen(function* () {
        const client = yield* AflApi;

        const error = yield* Effect.flip(client.fetchRoundMatchItems("invalid"));

        expect(error.message).toBe("Request failed: 400 Bad Request");
      }).pipe(
        Effect.provide(
          aflApiWith([
            sequence(
              mockResponse(VALID_TOKEN),
              mockResponse({}, { status: 400, statusText: "Bad Request" }),
            ),
          ]),
        ),
      ),
    );
  });

  describe("fetchRoundMatchItemsByNumber", () => {
    it.effect("resolves round providerId and fetches match items", () => {
      const rounds = {
        rounds: [{ id: 1147, providerId: "CD_R202501401", name: "Round 1", roundNumber: 1 }],
      };

      const matchItems = {
        roundId: "CD_R202501401",
        items: [
          {
            match: {
              matchId: "CD_M1",
              status: "CONCLUDED",
              utcStartTime: "2025-03-13",
              homeTeamId: "t1",
              awayTeamId: "t2",
              homeTeam: { name: "A", teamId: "t1" },
              awayTeam: { name: "B", teamId: "t2" },
            },
          },
        ],
      };

      return Effect.gen(function* () {
        const client = yield* AflApi;

        expect(yield* client.fetchRoundMatchItemsByNumber(73, 1)).toHaveLength(1);
      }).pipe(
        Effect.provide(
          aflApiWith([
            sequence(mockResponse(rounds), mockResponse(VALID_TOKEN), mockResponse(matchItems)),
          ]),
        ),
      );
    });

    it.effect("fails when round not found", () =>
      Effect.gen(function* () {
        const client = yield* AflApi;

        const error = yield* Effect.flip(client.fetchRoundMatchItemsByNumber(73, 99));

        expect(error.message).toBe("Round not found or missing providerId: round 99");
      }).pipe(
        Effect.provide(
          aflApiWith([
            sequence(
              mockResponse({
                rounds: [{ id: 1147, providerId: "CD_R1", name: "Round 1", roundNumber: 1 }],
              }),
            ),
          ]),
        ),
      ),
    );
  });

  describe("fetchSeasonMatchItems", () => {
    it.effect("aggregates concluded matches from all rounds", () => {
      const rounds = {
        rounds: [
          { id: 1146, providerId: "CD_R1", name: "Round 1", roundNumber: 1 },
          { id: 1147, providerId: "CD_R2", name: "Round 2", roundNumber: 2 },
        ],
      };

      const round1Items = {
        items: [
          {
            match: {
              matchId: "CD_M1",
              status: "CONCLUDED",
              utcStartTime: "2025-03-13",
              homeTeamId: "t1",
              awayTeamId: "t2",
              homeTeam: { name: "A", teamId: "t1" },
              awayTeam: { name: "B", teamId: "t2" },
            },
          },
        ],
      };

      const round2Items = {
        items: [
          {
            match: {
              matchId: "CD_M2",
              status: "UPCOMING",
              utcStartTime: "2025-03-20",
              homeTeamId: "t3",
              awayTeamId: "t4",
              homeTeam: { name: "C", teamId: "t3" },
              awayTeam: { name: "D", teamId: "t4" },
            },
          },
        ],
      };

      const route = byUrl((url) => {
        if (url.includes("compseasons")) return mockResponse(rounds);

        if (url.includes("WMCTok")) return mockResponse(VALID_TOKEN);

        if (url.includes("CD_R1")) return mockResponse(round1Items);

        if (url.includes("CD_R2")) return mockResponse(round2Items);

        return mockResponse({}, { status: 404 });
      });

      return Effect.gen(function* () {
        const client = yield* AflApi;

        const items = yield* client.fetchSeasonMatchItems(73);

        expect(items).toHaveLength(1);
        expect(items[0]?.match.matchId).toBe("CD_M1");
      }).pipe(Effect.provide(aflApiWith([route])));
    });
  });

  describe("fetchPlayerStats", () => {
    it.effect("returns player stats for a match", () => {
      const playerStats = {
        homeTeamPlayerStats: [
          {
            player: {
              player: {
                position: "FWD",
                player: {
                  playerId: "CD_I1",
                  playerName: { givenName: "Test", surname: "Player" },
                },
              },
              jumperNumber: 1,
            },
            teamId: "CD_T1",
            playerStats: { stats: { goals: 3.0, kicks: 15.0 } },
          },
        ],
        awayTeamPlayerStats: [],
      };

      return Effect.gen(function* () {
        const client = yield* AflApi;

        const stats = yield* client.fetchPlayerStats("CD_M1");

        expect(stats.homeTeamPlayerStats).toHaveLength(1);
        expect(stats.awayTeamPlayerStats).toHaveLength(0);
      }).pipe(
        Effect.provide(
          aflApiWith([sequence(mockResponse(VALID_TOKEN), mockResponse(playerStats))]),
        ),
      );
    });
  });

  describe("fetchMatchRoster", () => {
    it.effect("returns match roster for a match", () => {
      const roster = {
        match: {
          matchId: "CD_M1",
          status: "CONCLUDED",
          utcStartTime: "2025-03-13",
          homeTeamId: "CD_T120",
          awayTeamId: "CD_T30",
          homeTeam: { name: "Richmond", teamId: "CD_T120" },
          awayTeam: { name: "Carlton", teamId: "CD_T30" },
        },
        teamPlayers: [
          { teamId: "CD_T120", players: [] },
          { teamId: "CD_T30", players: [] },
        ],
      };

      return Effect.gen(function* () {
        const client = yield* AflApi;

        const result = yield* client.fetchMatchRoster("CD_M1");

        expect(result.teamPlayers).toHaveLength(2);
      }).pipe(
        Effect.provide(aflApiWith([sequence(mockResponse(VALID_TOKEN), mockResponse(roster))])),
      );
    });
  });

  describe("fetchTeams", () => {
    it.effect("returns all teams when no filter provided", () =>
      Effect.gen(function* () {
        const client = yield* AflApi;

        expect(yield* client.fetchTeams()).toHaveLength(2);
      }).pipe(
        Effect.provide(
          aflApiWith([
            sequence(
              mockResponse({
                teams: [
                  { id: 1, name: "Adelaide Crows", teamType: "MEN" },
                  { id: 2, name: "Adelaide Crows W", teamType: "WOMEN" },
                ],
              }),
            ),
          ]),
        ),
      ),
    );

    it.effect("filters by competition when provided", () =>
      Effect.gen(function* () {
        const client = yield* AflApi;

        const teams = yield* client.fetchTeams("AFLM");

        expect(teams).toHaveLength(1);
        expect(teams[0]?.name).toBe("Adelaide Crows");
      }).pipe(
        Effect.provide(
          aflApiWith([
            sequence(
              mockResponse({
                teams: [
                  { id: 1, name: "Adelaide Crows", teamType: "MEN" },
                  { id: 2, name: "Adelaide Crows W", teamType: "WOMEN" },
                  { id: 3, name: "Footscray Bulldogs", teamType: "VFL_MEN" },
                ],
              }),
            ),
          ]),
        ),
      ),
    );

    it.effect("scopes to VFL teams when given VFL", () =>
      Effect.gen(function* () {
        const client = yield* AflApi;

        const teams = yield* client.fetchTeams("VFL");

        expect(teams).toHaveLength(1);
        expect(teams[0]?.name).toBe("Footscray Bulldogs");
      }).pipe(
        Effect.provide(
          aflApiWith([
            sequence(
              mockResponse({
                teams: [
                  { id: 1, name: "Adelaide Crows", teamType: "MEN" },
                  { id: 3, name: "Footscray Bulldogs", teamType: "VFL_MEN" },
                ],
              }),
            ),
          ]),
        ),
      ),
    );
  });

  describe("fetchSquad", () => {
    it.effect("returns squad for a team and season", () =>
      Effect.gen(function* () {
        const client = yield* AflApi;

        const squad = yield* client.fetchSquad(1, 73);

        expect(squad.squad.players).toHaveLength(1);
      }).pipe(
        Effect.provide(
          aflApiWith([
            sequence(
              mockResponse({
                squad: {
                  players: [
                    {
                      player: { id: 1910, firstName: "Chris", surname: "Burgess" },
                      jumperNumber: 21,
                      position: "KEY_FORWARD",
                    },
                  ],
                },
              }),
            ),
          ]),
        ),
      ),
    );
  });

  describe("shared client across adapters", () => {
    it.effect("shares one token across adapter registrations", () => {
      // Minimal valid fixtures for the schemas the adapters parse.
      const playerStatsResponse = {
        homeTeamPlayerStats: [],
        awayTeamPlayerStats: [],
      };

      const rosterResponse = {
        match: {
          matchId: "CD_M1",
          status: "CONCLUDED",
          utcStartTime: "2025-03-13",
          homeTeamId: "CD_T120",
          awayTeamId: "CD_T30",
          homeTeam: { name: "Richmond", teamId: "CD_T120" },
          awayTeam: { name: "Carlton", teamId: "CD_T30" },
        },
        teamPlayers: [
          { teamId: "CD_T120", players: [] },
          { teamId: "CD_T30", players: [] },
        ],
      };

      const inventory: readonly MatchItem[] = [
        {
          match: rosterResponse.match,
          round: { name: "Round 1", roundId: "CD_R202501401", roundNumber: 1 },
        },
      ];

      // The adapters call multiple authed endpoints; only the first triggers
      // authentication, because every adapter reads the one AflApi service.
      const log = requestLog();

      const route = byUrl((url) => {
        if (url.includes("WMCTok")) return mockResponse(VALID_TOKEN);

        if (url.includes("matchRoster")) return mockResponse(rosterResponse);

        if (url.includes("playerStats")) return mockResponse(playerStatsResponse);

        return mockResponse({}, { status: 404 });
      });

      // The live client with season resolution stubbed to a fixed inventory.
      const sharedClient = Layer.effect(
        AflApi,
        Effect.gen(function* () {
          const live = yield* AflApi;

          return {
            ...live,
            resolveCompSeason: () => Effect.succeed(73),
            fetchSeasonMatchItems: () => Effect.succeed(inventory),
          };
        }),
      ).pipe(Layer.provide(aflApiWith([route], log)));

      return Effect.gen(function* () {
        const playerStatsAdapter = yield* aflApiPlayerStatsSource;
        const lineupAdapter = yield* aflApiLineupSource;

        yield* playerStatsAdapter.fetchPlayerStats({
          source: "afl-api",
          season: 2025,
          matchId: "CD_M1",
        });

        yield* lineupAdapter.fetchLineup({
          source: "afl-api",
          season: 2025,
          round: 1,
          matchId: "CD_M1",
        });

        // Exactly one token POST across both adapters, proving the cached
        // token on the shared client is reused.
        expect(log.urls.filter((url) => url.includes("WMCTok"))).toHaveLength(1);
      }).pipe(Effect.provide(sharedClient));
    });
  });
});
