import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  AflCoachesClient,
  isFinalsRound,
  parseCoachesVotesHtml,
} from "../../src/sources/afl-coaches";

const FIXTURE_PATH = resolve(__dirname, "../fixtures/afl-coaches-votes.html");
const fixtureHtml = readFileSync(FIXTURE_PATH, "utf-8");

describe("parseCoachesVotesHtml", () => {
  it("parses the fixture into coaches-vote records with the expected fields", () => {
    const votes = parseCoachesVotesHtml(fixtureHtml, 2024, 1, "AFLM");

    // Match 1: Cripps, Walsh, Martin (3) + Match 2: Dangerfield, Sicily (2).
    expect(votes).toHaveLength(5);

    const first = votes[0];
    expect(first).toBeDefined();
    if (!first) return;

    expect(first.type).toBe("coaches");
    expect(first.source).toBe("afl-coaches");
    expect(first.season).toBe(2024);
    expect(first.round).toBe(1);
    expect(first.competition).toBe("AFLM");
    expect(first.player).toBe("Patrick Cripps (Carlton)");
    expect(first.votes).toBe(10);
    expect(first.homeTeam).toBe("Carlton");
    expect(first.awayTeam).toBe("Richmond");
  });

  it("stamps every player in the first match with that match's home/away teams", () => {
    const votes = parseCoachesVotesHtml(fixtureHtml, 2024, 1, "AFLM");
    const matchOne = votes.filter((v) => v.homeTeam === "Carlton" && v.awayTeam === "Richmond");

    expect(matchOne.map((v) => v.player)).toEqual([
      "Patrick Cripps (Carlton)",
      "Sam Walsh (Carlton)",
      "Dustin Martin (Richmond)",
    ]);
    expect(matchOne.map((v) => v.votes)).toEqual([10, 8, 5]);
  });

  it("stamps a player in the second match with the second match's home/away teams (boundary)", () => {
    const votes = parseCoachesVotesHtml(fixtureHtml, 2024, 1, "AFLM");
    const dangerfield = votes.find((v) => v.player === "Patrick Dangerfield (Geelong)");

    expect(dangerfield).toBeDefined();
    if (!dangerfield) return;

    // The matchIndex must have advanced past match 1 — Geelong/Hawthorn, not Carlton/Richmond.
    expect(dangerfield.homeTeam).toBe("Geelong");
    expect(dangerfield.awayTeam).toBe("Hawthorn");
    expect(dangerfield.votes).toBe(9);
  });

  it("skips rows whose vote cell is non-numeric (NaN)", () => {
    const html = `<div class="pr-md-3 votes-by-match">
      <img class="club_logo" title="Carlton" />
      <img class="club_logo" title="Richmond" />
      <div class="col-10">Player (Club)</div><div class="col-2">Votes</div>
      <div class="col-10">Patrick Cripps (Carlton)</div><div class="col-2">10</div>
      <div class="col-10">Sam Walsh (Carlton)</div><div class="col-2">TBC</div>
    </div>`;

    const votes = parseCoachesVotesHtml(html, 2024, 1, "AFLM");

    expect(votes).toHaveLength(1);
    expect(votes[0]?.player).toBe("Patrick Cripps (Carlton)");
    // No record with a NaN/absent vote for the non-numeric row.
    expect(votes.some((v) => v.player === "Sam Walsh (Carlton)")).toBe(false);
  });

  it("skips rows for a match that has fewer club_logo titles than matches (missing team)", () => {
    // Two matches, but only the first carries club_logo elements. The second
    // match's rows reference homeTeams[1]/awayTeams[1] which are undefined.
    const html = `<div class="pr-md-3 votes-by-match">
      <img class="club_logo" title="Carlton" />
      <img class="club_logo" title="Richmond" />
      <div class="col-10">Player (Club)</div><div class="col-2">Votes</div>
      <div class="col-10">Patrick Cripps (Carlton)</div><div class="col-2">10</div>
      <div class="col-10">Player (Club)</div><div class="col-2">Votes</div>
      <div class="col-10">Patrick Dangerfield (Geelong)</div><div class="col-2">9</div>
    </div>`;

    const votes = parseCoachesVotesHtml(html, 2024, 1, "AFLM");

    // Only the first match's player survives.
    expect(votes).toHaveLength(1);
    expect(votes[0]?.player).toBe("Patrick Cripps (Carlton)");
    // No record was emitted with a null/empty team for the second match.
    expect(votes.some((v) => v.player === "Patrick Dangerfield (Geelong)")).toBe(false);
    expect(votes.every((v) => v.homeTeam.length > 0 && v.awayTeam.length > 0)).toBe(true);
  });

  it("returns an empty array for HTML with no votes-by-match container", () => {
    expect(parseCoachesVotesHtml("<html><body></body></html>", 2024, 1, "AFLM")).toEqual([]);
  });
});

describe("AflCoachesClient.scrapeRoundVotes", () => {
  it("builds the AFLCA URL and parses the returned HTML (offline round-trip)", async () => {
    let capturedUrl = "";
    const fetchFn = vi.fn(async (url: string | URL | Request) => {
      capturedUrl = String(url);
      return new Response(fixtureHtml, { status: 200 });
    }) as unknown as typeof fetch;

    const client = new AflCoachesClient({ fetchFn });
    const result = await client.scrapeRoundVotes(2024, 1, "AFLM", false);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(5);
      expect(result.data[0]?.source).toBe("afl-coaches");
    }

    // For season >= 2023 the path uses season/{season+1}{compSuffix}{roundPad}.
    expect(capturedUrl).toBe(
      "https://aflcoaches.com.au/awards/the-aflca-champion-player-of-the-year-award/leaderboard/2024/20250101",
    );
  });

  it("returns an error result on a non-OK response", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response("", { status: 404 }));
    const client = new AflCoachesClient({ fetchFn });

    const result = await client.scrapeRoundVotes(2024, 1, "AFLM", false);
    expect(result.success).toBe(false);
  });
});

describe("isFinalsRound", () => {
  // 2023: 24 H&A rounds confirmed by probe (Gary Ayres jump at round 25)
  it("returns false for round 24 in 2023 (last H&A round)", () => {
    expect(isFinalsRound(2023, 24)).toBe(false);
  });

  it("returns true for round 25 in 2023 (first finals round)", () => {
    expect(isFinalsRound(2023, 25)).toBe(true);
  });

  // 2019: 23 H&A rounds confirmed by probe (Gary Ayres jump at round 24)
  it("returns false for round 23 in 2019 (last H&A round)", () => {
    expect(isFinalsRound(2019, 23)).toBe(false);
  });

  it("returns true for round 24 in 2019 (first finals round)", () => {
    expect(isFinalsRound(2019, 24)).toBe(true);
  });

  // 2024: 25 H&A rounds confirmed by probe (Gary Ayres jump at round 26)
  it("returns false for round 25 in 2024 (last H&A round)", () => {
    expect(isFinalsRound(2024, 25)).toBe(false);
  });

  it("returns true for round 26 in 2024 (first finals round)", () => {
    expect(isFinalsRound(2024, 26)).toBe(true);
  });

  // Pre-2018: default last H&A = 23; Gary Ayres URL returns 404 for finals
  // rounds in these seasons (silently skipped), but the boundary is correct.
  it("returns false for round 23 in 2017 (last H&A round, default boundary)", () => {
    expect(isFinalsRound(2017, 23)).toBe(false);
  });

  it("returns true for round 24 in 2017 (after H&A ends)", () => {
    expect(isFinalsRound(2017, 24)).toBe(true);
  });

  // 2010: 22 H&A rounds confirmed by probe
  it("returns false for round 22 in 2010 (last H&A round)", () => {
    expect(isFinalsRound(2010, 22)).toBe(false);
  });

  it("returns true for round 23 in 2010 (after H&A ends)", () => {
    expect(isFinalsRound(2010, 23)).toBe(true);
  });

  // Default boundary applies to unlisted seasons (DEFAULT_LAST_HA_ROUND = 23)
  it("uses the default boundary (23) for an unlisted season", () => {
    expect(isFinalsRound(2015, 23)).toBe(false);
    expect(isFinalsRound(2015, 24)).toBe(true);
  });
});
