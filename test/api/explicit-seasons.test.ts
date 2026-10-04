import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchMatches } from "../../src/api/match";
import { fetchPlayerStats } from "../../src/api/player-stats";
import { AmbiguousSeasonError } from "../../src/lib/errors";
import { canonicalSeasonKey } from "../../src/lib/seasons";
import { CompseasonListSchema, MatchItemSchema } from "../../src/lib/validation";
import { AflApiMatchSource, AflApiPlayerStatsSource } from "../../src/sources/adapters/afl-api";
import { AflApiClient } from "../../src/sources/afl-api";

const seasons = CompseasonListSchema.parse(
  JSON.parse(
    readFileSync(new URL("../fixtures/aflw-provider-seasons.json", import.meta.url), "utf8"),
  ),
);
const inventory = (key: string) =>
  MatchItemSchema.array().parse(
    JSON.parse(
      readFileSync(new URL(`../fixtures/aflw-${key}-matches.json`, import.meta.url), "utf8"),
    ),
  );
afterEach(() => vi.restoreAllMocks());

function client() {
  const api = new AflApiClient();
  vi.spyOn(api, "resolveCompetitionId").mockResolvedValue({ success: true, data: 3 });
  vi.spyOn(api, "fetchCompseasons").mockResolvedValue({ success: true, data: seasons.compSeasons });
  return api;
}

describe("explicit competition seasons", () => {
  it("discovers both provider mappings without depending on list order", async () => {
    const result = await client().fetchSeasons("AFLW");
    expect(result.success && result.data.filter((s) => s.year === 2022)).toEqual([
      {
        competition: "AFLW",
        seasonKey: "2022-S6",
        year: 2022,
        displayName: "2022 NAB AFLW Season 6",
        providerSeasonId: 41,
      },
      {
        competition: "AFLW",
        seasonKey: "2022-S7",
        year: 2022,
        displayName: "2022 NAB AFLW Season 7",
        providerSeasonId: 51,
      },
    ]);
    expect(await client().resolveCompSeason("AFLW", "2022-S6")).toEqual({
      success: true,
      data: 41,
    });
    expect(await client().resolveCompSeason("AFLW", "2022-S7")).toEqual({
      success: true,
      data: 51,
    });
  });
  it("rejects ambiguous public requests and invalid competition selectors before any fetch", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("No network allowed"));
    for (const operation of [fetchMatches, fetchPlayerStats]) {
      const result = await operation({ source: "afl-api", competition: "AFLW", season: 2022 });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(AmbiguousSeasonError);
        expect(result.error).toMatchObject({ validSelectors: ["2022-S6", "2022-S7"] });
      }
    }
    expect(canonicalSeasonKey("AFLM", "2022-S6").success).toBe(false);
    expect(canonicalSeasonKey("AFLM", 2022)).toEqual({ success: true, data: "2022" });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("keeps the captured 75 and 99 match inventories separate", async () => {
    const api = client();
    vi.spyOn(api, "fetchSeasonMatchItems").mockImplementation(async (id) => ({
      success: true,
      data: inventory(id === 41 ? "2022-S6" : "2022-S7"),
    }));
    const adapter = new AflApiMatchSource(api);
    const six = await adapter.fetchMatches({
      source: "afl-api",
      competition: "AFLW",
      season: "2022-S6",
    });
    const seven = await adapter.fetchMatches({
      source: "afl-api",
      competition: "AFLW",
      season: "2022-S7",
    });
    expect(six.success && six.data.length).toBe(75);
    expect(seven.success && seven.data.length).toBe(99);
    if (!six.success || !seven.success) return;
    const first = new Set(six.data.map((m) => m.matchId));
    expect(seven.data.every((m) => !first.has(m.matchId) && m.season === 2022)).toBe(true);
  });
  it("rejects a match-ID shortcut from the other season before fetching statistics", async () => {
    const api = client();
    vi.spyOn(api, "fetchSeasonMatchItems").mockResolvedValue({
      success: true,
      data: inventory("2022-S6"),
    });
    const fetch = vi.spyOn(api, "fetchPlayerStats");
    const matchId = inventory("2022-S7")[0]?.match.matchId;
    expect(matchId).toBeDefined();
    const result = await new AflApiPlayerStatsSource(api).fetchPlayerStats({
      source: "afl-api",
      competition: "AFLW",
      season: "2022-S6",
      matchId,
    });
    expect(result.success).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("resolves season seven as current even when season six occurs first in the provider list", async () => {
    const api = client();
    vi.spyOn(api, "fetchCompseasons").mockResolvedValue({
      success: true,
      data: seasons.compSeasons.filter((s) => s.id === 41 || s.id === 51),
    });
    vi.spyOn(api, "resolveRounds").mockResolvedValue({
      success: true,
      data: [{ id: 1, name: "Round 1", roundNumber: 1, utcStartTime: "2022-08-25T09:00:00Z" }],
    });
    vi.spyOn(Date, "now").mockReturnValue(Date.parse("2022-09-01T00:00:00Z"));
    expect(await api.resolveCurrentSeason("AFLW")).toEqual({ success: true, data: "2022-S7" });
  });
});

it("does not relabel the pinned January Fryzigg snapshot as AFLW season seven", async () => {
  const network = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("No network allowed"));
  const result = await fetchPlayerStats({
    source: "fryzigg",
    competition: "AFLW",
    season: "2022-S7",
  });
  expect(result.success).toBe(false);
  if (!result.success) expect(result.error.message).toContain("season six only");
  expect(network).not.toHaveBeenCalled();
});
