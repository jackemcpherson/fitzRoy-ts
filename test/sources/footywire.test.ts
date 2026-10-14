import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer, Result } from "effect";
import { ScrapeError } from "../../src/lib/errors";
import type { Match } from "../../src/types";
import {
  FootyWire,
  FootyWireLive,
  parseFixtureList as parseFixtureListResult,
  parseMatchList as parseMatchListResult,
} from "../../src/sources/footywire";
import { fixtureHttp, fixtureText, type Route } from "../support/http";

const fixtureHtml = fixtureText("footywire-match-list.html");

const basicStatsHtml = fixtureText("footywire-match-stats-basic-11174.html");

const advancedStatsHtml = fixtureText("footywire-match-stats-advanced-11174.html");

/** The live FootyWire client over fixture routes. */
function footyWireWith(routes: readonly Route[]) {
  return FootyWireLive.pipe(Layer.provide(fixtureHttp(routes)));
}

/** Parse a match list that must succeed. */
function parseMatchList(html: string, year: number): Match[] {
  return Result.getOrThrow(parseMatchListResult(html, year));
}

/** Parse a fixture list that must succeed. */
function parseFixtureList(...args: Parameters<typeof parseFixtureListResult>): Match[] {
  return Result.getOrThrow(parseFixtureListResult(...args));
}

describe("parseMatchList", () => {
  it("parses complete match results from fixture", () => {
    const results = parseMatchList(fixtureHtml, 2025);

    expect(results.length).toBeGreaterThanOrEqual(3);

    const first = results[0];
    expect(first).toBeDefined();

    if (!first) return;

    // Teams and identity
    expect(first.homeTeam).toBe("Richmond");
    expect(first.awayTeam).toBe("Carlton");
    expect(first.matchId).toBe("FW_11193");
    expect(first.source).toBe("footywire");
    expect(first.competition).toBe("AFLM");

    // Scores
    expect(first.homePoints).toBe(82);
    expect(first.awayPoints).toBe(69);
    expect(first.margin).toBe(13);

    // Metadata
    expect(first.venue).toBe("MCG");
    expect(first.attendance).toBe(85000);

    // Quarter scores not available on match list page
    expect(first.q1Home).toBeNull();
    expect(first.q4Away).toBeNull();
  });

  it("emits null goals/behinds — the match-list page only publishes total points (COR-04)", () => {
    const results = parseMatchList(fixtureHtml, 2025);
    const first = results[0];
    expect(first).toBeDefined();

    if (!first) return;

    expect(first.homePoints).toBe(82);
    expect(first.homeGoals).toBeNull();
    expect(first.homeBehinds).toBeNull();
    expect(first.awayGoals).toBeNull();
    expect(first.awayBehinds).toBeNull();
  });

  it("extracts round numbers from headers", () => {
    const results = parseMatchList(fixtureHtml, 2025);

    expect(results.filter((r) => r.roundNumber === 1)).toHaveLength(2);
    expect(results.filter((r) => r.roundNumber === 2)).toHaveLength(1);
  });

  it("normalises team names", () => {
    const results = parseMatchList(fixtureHtml, 2025);
    expect(results[1]?.awayTeam).toBe("Brisbane Lions");
  });

  it("returns empty array for empty HTML", () => {
    expect(parseMatchList("<html></html>", 2025)).toEqual([]);
  });

  it("preserves a legitimate 0 attendance rather than nulling it", () => {
    // Behind-closed-doors 2020 COVID matches recorded an attendance of 0.
    // The old `parseInt(...) || null` idiom collapsed that genuine 0 to null.
    const html = `<html><body><table>
      <tr><td colspan="7">Round 5</td></tr>
      <tr>
        <td class="data">Sat 1 May 7:30pm</td>
        <td class="data"><a>Hawthorn</a><a>Geelong Cats</a></td>
        <td class="data">MCG</td>
        <td class="data">0</td>
        <td class="data"><a href="?mid=9999">82-69</a></td>
      </tr>
    </table></body></html>`;

    const results = parseMatchList(html, 2025);
    expect(results).toHaveLength(1);
    expect(results[0]?.attendance).toBe(0);
  });
});

describe("parseFixtureList (#122)", () => {
  it("populates homePoints/awayPoints/margin when score is present, leaving goals/behinds null", () => {
    const fixtures = parseFixtureList(fixtureHtml, 2025);
    const completed = fixtures.filter((f) => f.status === "Complete");
    expect(completed.length).toBeGreaterThan(0);

    const first = completed[0];
    expect(first).toBeDefined();

    if (!first) return;

    // Same fixture as parseMatchList's first row: Richmond v Carlton 82-69.
    expect(first.homeTeam).toBe("Richmond");
    expect(first.awayTeam).toBe("Carlton");
    expect(first.homePoints).toBe(82);
    expect(first.awayPoints).toBe(69);
    expect(first.margin).toBe(13);
    // Goals/behinds are null — the match-list page only publishes total
    // points, and fabricating them from the total produced wrong data
    // (COR-04).
    expect(first.homeGoals).toBeNull();
    expect(first.homeBehinds).toBeNull();
    expect(first.awayGoals).toBeNull();
    expect(first.awayBehinds).toBeNull();
  });

  it("leaves scores null for upcoming matches", () => {
    // Synthesise a row with no score column populated.
    const html = `<html><body><table>
      <tr><td colspan="7">Round 5</td></tr>
      <tr>
        <td class="data">Sat 1 May 7:30pm</td>
        <td class="data"><a>Hawthorn</a><br><a>Geelong Cats</a></td>
        <td class="data">MCG</td>
        <td class="data">12345</td>
        <td class="data"></td>
      </tr>
    </table></body></html>`;

    const fixtures = parseFixtureList(html, 2025);
    expect(fixtures).toHaveLength(1);
    expect(fixtures[0]?.status).toBe("Upcoming");
    expect(fixtures[0]?.homePoints).toBeNull();
    expect(fixtures[0]?.awayPoints).toBeNull();
    expect(fixtures[0]?.margin).toBeNull();
    expect(fixtures[0]?.matchId).toBe("FW_SYNTH_2025_R5_G1");
  });

  it.effect("uses the provider id for a completed match and matches player-stat ids", () => {
    const html = `<html><body><table>
      <tr><td colspan="7">Round 5</td></tr>
      <tr>
        <td class="data">Sat 1 May 7:30pm</td>
        <td class="data"><a>Hawthorn</a><br><a>Geelong Cats</a></td>
        <td class="data">MCG</td><td class="data">12345</td>
        <td class="data"><a href="ft_match_statistics?mid=11174">82-69</a></td>
      </tr>
    </table></body></html>`;

    const match = parseFixtureList(html, 2025)[0];

    return Effect.gen(function* () {
      const stats = yield* FootyWire.use((client) =>
        client.fetchMatchPlayerStats("11174", 2025, 5),
      );

      expect(match?.matchId).toBe("FW_11174");
      expect(stats.length).toBeGreaterThan(0);
      expect(stats[0]?.matchId).toBe(match?.matchId);
    }).pipe(
      Effect.provide(
        footyWireWith([
          ["advv=Y", { body: advancedStatsHtml }],
          ["ft_match_statistics", { body: basicStatsHtml }],
        ]),
      ),
    );
  });

  it("rejects an unparseable required date instead of returning January 1", () => {
    const html = `<html><body><table>
      <tr><td colspan="7">Round 5</td></tr>
      <tr><td class="data"></td><td class="data"><a>Hawthorn</a><a>Geelong Cats</a></td>
      <td class="data">MCG</td><td class="data"></td><td class="data"><a href="?mid=1">82-69</a></td></tr>
    </table></body></html>`;

    const fixtureResult = parseFixtureListResult(html, 2025);
    const matchResult = parseMatchListResult(html, 2025);

    expect(Result.isFailure(fixtureResult)).toBe(true);
    expect(Result.isFailure(matchResult)).toBe(true);

    if (Result.isFailure(fixtureResult)) {
      expect(fixtureResult.failure.message).toMatch(/required FootyWire match date/);
    }

    if (Result.isFailure(matchResult)) {
      expect(matchResult.failure.message).toMatch(/required FootyWire match date/);
    }
  });

  it.effect("fails fetchSeasonFixture and fetchSeasonResults with the wrapped date message", () => {
    const html = `<html><body><table>
      <tr><td colspan="7">Round 5</td></tr>
      <tr><td class="data"></td><td class="data"><a>Hawthorn</a><a>Geelong Cats</a></td>
      <td class="data">MCG</td><td class="data"></td><td class="data"><a href="?mid=1">82-69</a></td></tr>
    </table></body></html>`;

    return Effect.gen(function* () {
      const client = yield* FootyWire;
      const fixtureError = yield* Effect.flip(client.fetchSeasonFixture(2025));
      const resultsError = yield* Effect.flip(client.fetchSeasonResults(2025));

      expect(fixtureError).toBeInstanceOf(ScrapeError);
      expect(fixtureError.message).toBe(
        'Failed to parse fixture list: Unable to parse required FootyWire match date: ""',
      );
      expect(resultsError.message).toBe(
        'Failed to parse match list: Unable to parse required FootyWire match date: ""',
      );
    }).pipe(Effect.provide(footyWireWith([["ft_match_list", { body: html }]])));
  });

  it("rolls a January AFLW row to the next calendar year (#111)", () => {
    // Synthesise an AFLW-style fixture row dated in January. With the
    // season labelled 2025 and AFLW opening in August, a January row
    // must belong to January 2026, not January 2025.
    const html = `<html><body><table>
      <tr><td colspan="7">Round 1</td></tr>
      <tr>
        <td class="data">Sat 10 Jan 7:30pm</td>
        <td class="data"><a>Carlton</a><br><a>Collingwood</a></td>
        <td class="data">IKON Park</td>
        <td class="data">12345</td>
        <td class="data"></td>
      </tr>
    </table></body></html>`;

    const fixtures = parseFixtureList(html, 2025, "AFLW");
    expect(fixtures).toHaveLength(1);
    expect(fixtures[0]?.competition).toBe("AFLW");
    expect(fixtures[0]?.date.getUTCFullYear()).toBe(2026);
    expect(fixtures[0]?.date.getUTCMonth()).toBe(0); // January
  });

  it("does not roll an August row for AFLW season 2025 (#111)", () => {
    // An August row is on/after the AFLW opener; it belongs to the
    // season-labelled calendar year, not year + 1.
    const html = `<html><body><table>
      <tr><td colspan="7">Round 1</td></tr>
      <tr>
        <td class="data">Sat 9 Aug 7:30pm</td>
        <td class="data"><a>Carlton</a><br><a>Collingwood</a></td>
        <td class="data">IKON Park</td>
        <td class="data">12345</td>
        <td class="data"></td>
      </tr>
    </table></body></html>`;

    const fixtures = parseFixtureList(html, 2025, "AFLW");
    expect(fixtures).toHaveLength(1);
    expect(fixtures[0]?.date.getUTCFullYear()).toBe(2025);
  });

  it("AFLM season is calendar-year-aligned — March row stays in season year", () => {
    const html = `<html><body><table>
      <tr><td colspan="7">Round 1</td></tr>
      <tr>
        <td class="data">Sat 15 Mar 7:30pm</td>
        <td class="data"><a>Carlton</a><br><a>Richmond</a></td>
        <td class="data">MCG</td>
        <td class="data">12345</td>
        <td class="data"></td>
      </tr>
    </table></body></html>`;

    const fixtures = parseFixtureList(html, 2025);
    expect(fixtures).toHaveLength(1);
    expect(fixtures[0]?.competition).toBe("AFLM");
    expect(fixtures[0]?.date.getUTCFullYear()).toBe(2025);
  });
});

describe("FootyWire", () => {
  it.effect("fetches and parses season results", () =>
    Effect.gen(function* () {
      const results = yield* FootyWire.use((client) => client.fetchSeasonResults(2025));

      expect(results.length).toBeGreaterThanOrEqual(3);
    }).pipe(Effect.provide(footyWireWith([["ft_match_list", { body: fixtureHtml }]]))),
  );

  it.effect("fails with a ScrapeError on non-OK response", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(FootyWire.use((client) => client.fetchSeasonResults(2025)));

      expect(error).toBeInstanceOf(ScrapeError);
      expect(error.message).toBe(
        "FootyWire request failed: 403 (https://www.footywire.com/afl/footy/ft_match_list?year=2025)",
      );
    }).pipe(Effect.provide(footyWireWith([["ft_match_list", { status: 403 }]]))),
  );

  it.effect("fails with a ScrapeError on network failure", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(FootyWire.use((client) => client.fetchSeasonResults(2025)));

      expect(error).toBeInstanceOf(ScrapeError);
      expect(error.message).toBe("FootyWire request failed: Network error");
    }).pipe(
      Effect.provide(
        footyWireWith([
          [
            "ft_match_list",
            {
              respond: () => {
                throw new Error("Network error");
              },
            },
          ],
        ]),
      ),
    ),
  );
});
