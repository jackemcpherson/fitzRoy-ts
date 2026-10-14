/**
 * FootyWire scraper client for match results and player statistics.
 *
 * Parses HTML from footywire.com using Cheerio. Used as a fallback source
 * when AFL API data is delayed or unavailable.
 */

import { Context, Effect, Layer, Result } from "effect";
import { parseDate } from "../lib/date-utils";
import { ScrapeError } from "../lib/errors";
import { readText, SourceHttp } from "../lib/http";
import { parseHtml } from "../lib/parse-html";
import { safeInt } from "../lib/parse-utils";
import { normaliseTeamName } from "../lib/team-mapping";
import { emptyMetricSet } from "../lib/team-metrics";
import { normaliseVenueName } from "../lib/venue-mapping";
import { resolveVenueTimezone } from "../lib/venue-timezones";
import {
  mergeFootyWireStats,
  parseAdvancedStats,
  parseBasicStats,
} from "../transforms/footywire-player-stats";
import { finalsRoundNumber, inferRoundType, toRoundCode } from "../transforms/match-results";
import type {
  CompetitionCode,
  Match,
  PlayerDetails,
  PlayerStats,
  RoundType,
  TeamMetricSet,
  TeamStatsEntry,
} from "../types";

const FOOTYWIRE_BASE = "https://www.footywire.com/afl/footy";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/** A match ID and its round number from a season match list. */
export interface FootyWireMatchIdEntry {
  readonly matchId: string;
  readonly roundNumber: number;
}

/**
 * FootyWire scraper client.
 */
export class FootyWire extends Context.Service<
  FootyWire,
  {
    /**
     * Fetch the HTML content of any FootyWire URL.
     *
     * Used by external modules (e.g. awards) that need to scrape FootyWire pages.
     */
    readonly fetchPage: (url: string) => Effect.Effect<string, ScrapeError>;
    /**
     * Fetch season match results from FootyWire.
     *
     * @param year - The season year.
     */
    readonly fetchSeasonResults: (year: number) => Effect.Effect<Match[], ScrapeError>;
    /**
     * Fetch player statistics for a single match.
     *
     * Scrapes both the basic and advanced stats pages. Available from 2010 onwards.
     *
     * @param matchId - The FootyWire match ID (numeric string).
     * @param season - The season year.
     * @param roundNumber - The round number.
     */
    readonly fetchMatchPlayerStats: (
      matchId: string,
      season: number,
      roundNumber: number,
    ) => Effect.Effect<PlayerStats[], ScrapeError>;
    /**
     * Fetch match IDs from a season's match list page.
     *
     * Extracts `mid=XXXX` values from score links alongside round numbers.
     *
     * @param year - The season year.
     */
    readonly fetchSeasonMatchIds: (
      year: number,
    ) => Effect.Effect<FootyWireMatchIdEntry[], ScrapeError>;
    /**
     * Fetch the player list (team history) for a team.
     *
     * @param teamName - Canonical team name (e.g. "Hawthorn").
     */
    readonly fetchPlayerList: (
      teamName: string,
    ) => Effect.Effect<Omit<PlayerDetails, "source" | "competition">[], ScrapeError>;
    /**
     * Fetch fixture data (played and upcoming matches) from FootyWire.
     *
     * @param year - The season year.
     * @param competition - Used to roll cross-calendar dates to year + 1 when
     *   the parsed month precedes the season opener. Defaults to AFLM.
     */
    readonly fetchSeasonFixture: (
      year: number,
      competition?: CompetitionCode,
    ) => Effect.Effect<Match[], ScrapeError>;
    /**
     * Fetch team statistics (totals or averages) for a season.
     *
     * @param year - The season year.
     * @param summaryType - "totals" or "averages" (default "totals").
     */
    readonly fetchTeamStats: (
      year: number,
      summaryType?: "totals" | "averages",
    ) => Effect.Effect<TeamStatsEntry[], ScrapeError>;
  }
>()("fitzroy/FootyWire") {}

/** Message of a thrown parse failure, matching the v6 `cause.message` text. */
function causeMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

/**
 * Run a parser, mapping a thrown failure to a `ScrapeError` with `prefix`.
 */
function parseWith<A>(prefix: string, parse: () => A): Effect.Effect<A, ScrapeError> {
  return Effect.try({
    try: parse,
    catch: (cause) =>
      new ScrapeError({ message: `${prefix}: ${causeMessage(cause)}`, source: "footywire" }),
  });
}

/**
 * Run a parser returning a `Result`, mapping either a thrown failure or a
 * failed result to a `ScrapeError` with `prefix`.
 */
function parseResultWith<A>(
  prefix: string,
  parse: () => Result.Result<A, ScrapeError>,
): Effect.Effect<A, ScrapeError> {
  return parseWith(prefix, parse).pipe(
    Effect.flatMap((result) =>
      Result.isSuccess(result)
        ? Effect.succeed(result.success)
        : Effect.fail(
            new ScrapeError({
              message: `${prefix}: ${result.failure.message}`,
              source: "footywire",
            }),
          ),
    ),
  );
}

/** The live FootyWire client over {@link SourceHttp}. */
export const FootyWireLive = Layer.effect(
  FootyWire,
  Effect.gen(function* () {
    const http = yield* SourceHttp;

    const requestFailed = (message: string) =>
      new ScrapeError({ message: `FootyWire request failed: ${message}`, source: "footywire" });

    const fetchHtml = (url: string): Effect.Effect<string, ScrapeError> =>
      Effect.gen(function* () {
        const response = yield* http.request(url, { headers: { "User-Agent": USER_AGENT } });

        if (!response.ok) {
          return yield* Effect.fail(requestFailed(`${response.status} (${url})`));
        }

        return yield* readText(response);
      }).pipe(
        Effect.catchTag("RequestError", (error) => Effect.fail(requestFailed(error.message))),
      );

    /**
     * Fetch two pages concurrently; the first page's failure takes
     * precedence over the second's, whichever finishes first.
     */
    const fetchPair = (first: string, second: string) =>
      Effect.all([Effect.result(fetchHtml(first)), Effect.result(fetchHtml(second))], {
        concurrency: "unbounded",
      }).pipe(
        Effect.flatMap(([a, b]) =>
          Effect.fromResult(a).pipe(
            Effect.flatMap((aHtml) =>
              Effect.fromResult(b).pipe(Effect.map((bHtml) => [aHtml, bHtml] as const)),
            ),
          ),
        ),
      );

    const matchListUrl = (year: number) => `${FOOTYWIRE_BASE}/ft_match_list?year=${year}`;

    return {
      fetchPage: fetchHtml,
      fetchSeasonResults: (year) =>
        fetchHtml(matchListUrl(year)).pipe(
          Effect.flatMap((html) =>
            parseResultWith("Failed to parse match list", () => parseMatchList(html, year)),
          ),
        ),
      fetchMatchPlayerStats: (matchId, season, roundNumber) =>
        fetchPair(
          `${FOOTYWIRE_BASE}/ft_match_statistics?mid=${matchId}`,
          `${FOOTYWIRE_BASE}/ft_match_statistics?mid=${matchId}&advv=Y`,
        ).pipe(
          Effect.flatMap(([basicHtml, advancedHtml]) =>
            parseWith("Failed to parse match stats", () =>
              mergeFootyWireStats(
                parseBasicStats(basicHtml),
                parseAdvancedStats(advancedHtml),
                matchId,
                season,
                roundNumber,
              ),
            ),
          ),
        ),
      fetchSeasonMatchIds: (year) =>
        fetchHtml(matchListUrl(year)).pipe(
          Effect.flatMap((html) =>
            parseWith("Failed to parse match IDs", () => parseMatchIds(html)),
          ),
        ),
      fetchPlayerList: (teamName) => {
        const slug = teamNameToFootyWireSlug(teamName);

        if (!slug) {
          return Effect.fail(
            new ScrapeError({
              message: `No FootyWire slug mapping for team: ${teamName}`,
              source: "footywire",
            }),
          );
        }

        return fetchHtml(`${FOOTYWIRE_BASE}/tp-${slug}`).pipe(
          Effect.flatMap((html) =>
            parseWith("Failed to parse player list", () =>
              parseFootyWirePlayerList(html, teamName),
            ),
          ),
        );
      },
      fetchSeasonFixture: (year, competition = "AFLM") =>
        fetchHtml(matchListUrl(year)).pipe(
          Effect.flatMap((html) =>
            parseResultWith("Failed to parse fixture list", () =>
              parseFixtureList(html, year, competition),
            ),
          ),
        ),
      fetchTeamStats: (year, summaryType = "totals") => {
        const teamType = summaryType === "averages" ? "TA" : "TT";
        const oppType = summaryType === "averages" ? "OA" : "OT";

        return fetchPair(
          `${FOOTYWIRE_BASE}/ft_team_rankings?year=${year}&type=${teamType}&sby=2`,
          `${FOOTYWIRE_BASE}/ft_team_rankings?year=${year}&type=${oppType}&sby=2`,
        ).pipe(
          Effect.flatMap(([teamHtml, oppHtml]) =>
            parseWith("Failed to parse team stats", () =>
              // Merge into canonical for/against TeamStatsEntry per team
              mergeTeamAndOppStats(
                parseFootyWireTeamStats(teamHtml, year),
                parseFootyWireTeamStats(oppHtml, year),
                year,
              ),
            ),
          ),
        );
      },
    };
  }),
);

/** The failure for a match row whose required date does not parse. */
function unparseableDate(dateText: string): ScrapeError {
  return new ScrapeError({
    message: `Unable to parse required FootyWire match date: ${JSON.stringify(dateText)}`,
    source: "footywire",
  });
}

/**
 * Parse match IDs and round numbers from a FootyWire match list page.
 *
 * @param html - Raw HTML from the FootyWire match list page.
 */
function parseMatchIds(html: string): FootyWireMatchIdEntry[] {
  const $ = parseHtml(html);
  const entries: FootyWireMatchIdEntry[] = [];
  let currentRound = 0;
  let lastHARound = 0;

  $("tr").each((_i, row) => {
    const roundHeader = $(row).find("td[colspan='7']");

    if (roundHeader.length > 0) {
      const text = roundHeader.text().trim();
      const roundMatch = /Round\s+(\d+)/i.exec(text);

      if (roundMatch?.[1]) {
        currentRound = Number.parseInt(roundMatch[1], 10);

        if (inferRoundType(text) === "HomeAndAway") {
          lastHARound = currentRound;
        }
      } else if (inferRoundType(text) === "Finals") {
        currentRound = finalsRoundNumber(text, lastHARound);
      }

      return;
    }

    const scoreLink = $(row).find(".data:nth-child(5) a");

    if (scoreLink.length === 0) return;

    const href = scoreLink.attr("href") ?? "";
    const midMatch = /mid=(\d+)/.exec(href);

    if (midMatch?.[1]) {
      entries.push({ matchId: midMatch[1], roundNumber: currentRound });
    }
  });

  return entries;
}

/**
 * Parse FootyWire match list HTML into Match objects.
 *
 * @param html - Raw HTML from the FootyWire match list page.
 * @param year - The season year used for date parsing and metadata.
 * @returns The match results extracted from the page, or a `ScrapeError`
 *   for the first row whose required date does not parse.
 */
export function parseMatchList(html: string, year: number): Result.Result<Match[], ScrapeError> {
  const $ = parseHtml(html);
  const results: Match[] = [];
  let failure: ScrapeError | undefined;
  let currentRound = 0;
  let lastHARound = 0;
  let currentRoundType: RoundType = "HomeAndAway";
  let currentRoundName = "";

  // Each row is either a round header (colspan=7) or a match row
  $("tr").each((_i, row) => {
    const roundHeader = $(row).find("td[colspan='7']");

    if (roundHeader.length > 0) {
      const text = roundHeader.text().trim();
      currentRoundName = text;
      currentRoundType = inferRoundType(text);
      const roundMatch = /Round\s+(\d+)/i.exec(text);

      if (roundMatch?.[1]) {
        currentRound = Number.parseInt(roundMatch[1], 10);

        if (currentRoundType === "HomeAndAway") {
          lastHARound = currentRound;
        }
      } else if (currentRoundType === "Finals") {
        currentRound = finalsRoundNumber(text, lastHARound);
      }

      return;
    }

    const cells = $(row).find("td.data");

    if (cells.length < 5) return;

    // Cell 0: date, Cell 1: teams, Cell 2: venue, Cell 3: attendance, Cell 4: score
    const dateText = $(cells[0]).text().trim();
    const teamsCell = $(cells[1]);
    const venue = $(cells[2]).text().trim();
    const attendance = $(cells[3]).text().trim();
    const scoreCell = $(cells[4]);

    // Skip bye rows
    if (venue === "BYE") return;

    // Parse teams
    const teamLinks = teamsCell.find("a");

    if (teamLinks.length < 2) return;
    const homeTeam = normaliseTeamName($(teamLinks[0]).text().trim());
    const awayTeam = normaliseTeamName($(teamLinks[1]).text().trim());

    // Parse score (format: "82-69")
    const scoreText = scoreCell.text().trim();
    const scoreMatch = /(\d+)-(\d+)/.exec(scoreText);

    if (!scoreMatch) return;

    const homePoints = Number.parseInt(scoreMatch[1] ?? "0", 10);
    const awayPoints = Number.parseInt(scoreMatch[2] ?? "0", 10);

    // Parse match ID from score link
    const scoreLink = scoreCell.find("a").attr("href") ?? "";
    const midMatch = /mid=(\d+)/.exec(scoreLink);
    const matchId = midMatch?.[1] ? `FW_${midMatch[1]}` : `FW_${year}_R${currentRound}_${homeTeam}`;

    // Parse date with venue tz so non-Melbourne games (Brisbane, Perth, Adelaide)
    // produce the correct UTC instant.
    const canonicalVenue = normaliseVenueName(venue);
    const date = parseDate(dateText, { defaultYear: year, venue: canonicalVenue });

    if (!date) {
      failure = unparseableDate(dateText);

      return false;
    }

    // FootyWire's match-list page only carries total points — goals/behinds
    // are NOT published there. They used to be fabricated from the total
    // (floor(points / 6)), producing plausible-but-wrong data; emit null
    // instead so the gap is honest (COR-04).
    results.push({
      matchId,
      season: year,
      roundNumber: currentRound,
      roundType: currentRoundType,
      roundName: currentRoundName || null,
      date,
      venue: canonicalVenue,
      homeTeam,
      awayTeam,
      homeGoals: null,
      homeBehinds: null,
      homePoints,
      awayGoals: null,
      awayBehinds: null,
      awayPoints,
      margin: homePoints - awayPoints,
      q1Home: null,
      q2Home: null,
      q3Home: null,
      q4Home: null,
      q1Away: null,
      q2Away: null,
      q3Away: null,
      q4Away: null,
      status: "Complete",
      livePeriodStatus: null,
      matchClockPeriods: null,
      completedQuarter: null,
      attendance: safeInt(attendance ?? ""),
      weatherTempCelsius: null,
      weatherType: null,
      roundCode: toRoundCode(currentRoundName),
      venueState: null,
      venueTimezone: resolveVenueTimezone(canonicalVenue),
      venueLocalDate: null,
      homeRushedBehinds: null,
      awayRushedBehinds: null,
      homeMinutesInFront: null,
      awayMinutesInFront: null,
      source: "footywire",
      competition: "AFLM",
    });
  });

  return failure ? Result.fail(failure) : Result.succeed(results);
}

/**
 * 1-indexed calendar month each competition's season opens in. Used to
 * detect cross-calendar-year fixture rows: any row whose parsed month is
 * earlier than the opener belongs to the *following* calendar year, not
 * the season label (#111).
 *
 * AFLM is March–September within one calendar year (no rollover ever
 * triggers). AFLW historically ran Jan–Mar across calendar years and
 * currently opens in August; either layout is handled by the same rule.
 */
const SEASON_OPENER_MONTH: Record<CompetitionCode, number> = {
  AFLM: 3,
  AFLW: 8,
  VFL: 3,
  VFLW: 3,
};

/**
 * Parse FootyWire match list HTML into Match objects.
 *
 * Similar to parseMatchList but returns Match type (no scores required).
 * Includes both played and upcoming matches.
 *
 * @param html - Raw HTML from the FootyWire fixture page.
 * @param year - Season label (e.g. 2025). For AFLM this is the calendar
 *   year; for cross-calendar seasons (AFLW historically), rows whose
 *   parsed month is before the season opener are rolled to `year + 1`.
 * @param competition - Used to look up the season opener month. Defaults
 *   to AFLM since FootyWire AFLW coverage is not yet wired up.
 * @returns The fixtures, or a `ScrapeError` for the first row whose
 *   required date does not parse.
 */
export function parseFixtureList(
  html: string,
  year: number,
  competition: CompetitionCode = "AFLM",
): Result.Result<Match[], ScrapeError> {
  const openerMonth = SEASON_OPENER_MONTH[competition];
  const $ = parseHtml(html);
  const fixtures: Match[] = [];
  let failure: ScrapeError | undefined;
  let currentRound = 0;
  let lastHARound = 0;
  let currentRoundType: RoundType = "HomeAndAway";
  let gameNumber = 0;

  $("tr").each((_i, row) => {
    const roundHeader = $(row).find("td[colspan='7']");

    if (roundHeader.length > 0) {
      const text = roundHeader.text().trim();
      currentRoundType = inferRoundType(text);
      const roundMatch = /Round\s+(\d+)/i.exec(text);

      if (roundMatch?.[1]) {
        currentRound = Number.parseInt(roundMatch[1], 10);

        if (currentRoundType === "HomeAndAway") {
          lastHARound = currentRound;
        }
      } else if (currentRoundType === "Finals") {
        currentRound = finalsRoundNumber(text, lastHARound);
      }

      return;
    }

    const cells = $(row).find("td.data");

    if (cells.length < 3) return;

    const dateText = $(cells[0]).text().trim();
    const teamsCell = $(cells[1]);
    const venue = $(cells[2]).text().trim();

    if (venue === "BYE") return;

    const teamLinks = teamsCell.find("a");

    if (teamLinks.length < 2) return;
    const homeTeam = normaliseTeamName($(teamLinks[0]).text().trim());
    const awayTeam = normaliseTeamName($(teamLinks[1]).text().trim());

    const canonicalVenue = normaliseVenueName(venue);
    const initialDate = parseDate(dateText, { defaultYear: year, venue: canonicalVenue });

    if (!initialDate) {
      failure = unparseableDate(dateText);

      return false;
    }

    // Cross-calendar rollover: parseDate used `year` as the default. If the
    // resulting month is earlier than the season opener, the row actually
    // belongs to year + 1 (#111). For AFLM (opener month 3) this never
    // triggers because the season is calendar-year-aligned.
    const date =
      initialDate.getUTCMonth() + 1 < openerMonth
        ? (parseDate(dateText, { defaultYear: year + 1, venue: canonicalVenue }) ?? initialDate)
        : initialDate;

    gameNumber++;

    // Check if we have a score (match played) or not (upcoming).
    // When present, populate homePoints/awayPoints so completed matches
    // don't return as score-less (#122). Goals/behinds stay null: the
    // match-list page only publishes total points, and the old
    // floor(points / 6) estimate fabricated plausible-but-wrong values
    // (COR-04).
    const scoreCell = cells.length >= 5 ? $(cells[4]) : null;
    const scoreText = scoreCell?.text().trim() ?? "";
    const scoreMatch = /(\d+)-(\d+)/.exec(scoreText);
    const hasScore = scoreMatch !== null;

    let homePoints: number | null = null;
    let awayPoints: number | null = null;
    let margin: number | null = null;

    if (scoreMatch) {
      homePoints = Number.parseInt(scoreMatch[1] ?? "0", 10);
      awayPoints = Number.parseInt(scoreMatch[2] ?? "0", 10);
      margin = homePoints - awayPoints;
    }

    const scoreLink = scoreCell?.find("a").attr("href") ?? "";
    const providerId = /mid=(\d+)/.exec(scoreLink)?.[1];

    fixtures.push({
      matchId: providerId ? `FW_${providerId}` : `FW_SYNTH_${year}_R${currentRound}_G${gameNumber}`,
      season: year,
      roundNumber: currentRound,
      roundType: currentRoundType,
      roundName: null,
      date,
      venue: canonicalVenue,
      homeTeam,
      awayTeam,
      homeGoals: null,
      homeBehinds: null,
      homePoints,
      awayGoals: null,
      awayBehinds: null,
      awayPoints,
      margin,
      q1Home: null,
      q2Home: null,
      q3Home: null,
      q4Home: null,
      q1Away: null,
      q2Away: null,
      q3Away: null,
      q4Away: null,
      status: hasScore ? "Complete" : "Upcoming",
      livePeriodStatus: null,
      matchClockPeriods: null,
      completedQuarter: null,
      attendance: null,
      weatherTempCelsius: null,
      weatherType: null,
      roundCode: null,
      venueState: null,
      venueTimezone: resolveVenueTimezone(canonicalVenue),
      venueLocalDate: null,
      homeRushedBehinds: null,
      awayRushedBehinds: null,
      homeMinutesInFront: null,
      awayMinutesInFront: null,
      source: "footywire",
      competition,
    });
  });

  return failure ? Result.fail(failure) : Result.succeed(fixtures);
}

/** Intermediate per-direction parse result before for/against merge. */
interface FootyWireDirectionEntry {
  readonly team: string;
  readonly gamesPlayed: number | null;
  readonly metrics: TeamMetricSet;
}

/**
 * Canonical TeamMetricSet fields in FootyWire column order (0-indexed
 * columns 3-19): K, HB, D, M, G, GA, I50, BH, T, HO, FF, FA, CL, CG, R50,
 * AF, SC.
 */
const FOOTYWIRE_METRIC_COLUMNS = [
  "kicks",
  "handballs",
  "disposals",
  "marks",
  "goals",
  "goalAssists",
  "inside50s",
  "behinds",
  "tackles",
  "hitouts",
  "freesFor",
  "freesAgainst",
  "clearances",
  "clangers",
  "rebound50s",
  "fantasyPoints",
  "supercoachPoints",
] as const satisfies ReadonlyArray<keyof TeamMetricSet>;

/**
 * Parse FootyWire team statistics HTML into TeamStatsEntry objects.
 *
 * The R package uses `tables[[11]]` (the 11th table on the page) with
 * hardcoded column positions. Team name is in an `<a>` inside column 2.
 *
 * Columns (1-indexed): Rk(1), Team(2), Gm(3), K(4), HB(5), D(6), M(7),
 *   G(8), GA(9), I50(10), BH(11), T(12), HO(13), FF(14), FA(15),
 *   CL(16), CG(17), R50(18), AF(19), SC(20)
 *
 * @param html - Raw HTML from the FootyWire team rankings page.
 * @param year - The season year.
 *   The year is retained for API symmetry (callers may want to pass it for
 *   future per-year branching) even though the canonical entry is built later.
 * @returns One per-direction entry per team.
 */
export function parseFootyWireTeamStats(html: string, _year: number): FootyWireDirectionEntry[] {
  const $ = parseHtml(html);
  const entries: FootyWireDirectionEntry[] = [];

  const tables = $("table");
  // The R package uses tables[[11]] (1-indexed) → index 10 in 0-indexed
  // Fallback: look for table with class "sortable" or one containing team data
  const mainTable = tables.length > 10 ? $(tables[10]) : $("table.sortable").first();

  if (mainTable.length === 0) return entries;

  const rows = mainTable.find("tr");
  rows.each((rowIdx, row) => {
    if (rowIdx === 0) return; // skip header

    const cells = $(row).find("td");

    if (cells.length < 20) return;

    // Column 2 (0-indexed: 1) has team name inside an <a> tag
    const teamLink = $(cells[1]).find("a");
    const teamText = teamLink.length > 0 ? teamLink.text().trim() : $(cells[1]).text().trim();
    const teamName = normaliseTeamName(teamText);

    if (!teamName) return;

    const parseNum = (cell: ReturnType<typeof $>) => Number.parseFloat(cell.text().trim()) || 0;

    const parsedGamesPlayed = Number.parseFloat($(cells[2]).text().trim());
    const gamesPlayed = Number.isFinite(parsedGamesPlayed) ? parsedGamesPlayed : null;
    const metrics = emptyMetricSet();

    // Columns 3-19 (0-indexed) map to FOOTYWIRE_METRIC_COLUMNS
    FOOTYWIRE_METRIC_COLUMNS.forEach((canonical, i) => {
      metrics[canonical] = parseNum($(cells[i + 3]));
    });

    entries.push({
      team: teamName,
      gamesPlayed,
      metrics,
    });
  });

  return entries;
}

/**
 * Merge per-direction parse results into the canonical TeamStatsEntry
 * shape (one entry per team with both `for` and `against` metric sets).
 */
function mergeTeamAndOppStats(
  forStats: readonly FootyWireDirectionEntry[],
  againstStats: readonly FootyWireDirectionEntry[],
  year: number,
): TeamStatsEntry[] {
  const againstMap = new Map<string, FootyWireDirectionEntry>();

  for (const entry of againstStats) {
    againstMap.set(entry.team, entry);
  }

  return forStats.map((forEntry) => {
    const againstEntry = againstMap.get(forEntry.team);

    return {
      season: year,
      competition: "AFLM" as const,
      team: forEntry.team,
      gamesPlayed: forEntry.gamesPlayed,
      for: forEntry.metrics,
      against: againstEntry?.metrics ?? emptyMetricSet(),
      source: "footywire" as const,
    };
  });
}

// ---------------------------------------------------------------------------
// FootyWire team slug mapping
// ---------------------------------------------------------------------------

/** Map canonical team names to FootyWire URL slugs (used in `th-SLUG` pages). */
const FOOTYWIRE_SLUG_MAP: ReadonlyMap<string, string> = new Map([
  ["Adelaide Crows", "adelaide-crows"],
  ["Brisbane Lions", "brisbane-lions"],
  ["Carlton", "carlton-blues"],
  ["Collingwood", "collingwood-magpies"],
  ["Essendon", "essendon-bombers"],
  ["Fremantle", "fremantle-dockers"],
  ["Geelong Cats", "geelong-cats"],
  ["Gold Coast Suns", "gold-coast-suns"],
  ["GWS Giants", "greater-western-sydney-giants"],
  ["Hawthorn", "hawthorn-hawks"],
  ["Melbourne", "melbourne-demons"],
  ["North Melbourne", "north-melbourne-kangaroos"],
  ["Port Adelaide", "port-adelaide-power"],
  ["Richmond", "richmond-tigers"],
  ["St Kilda", "st-kilda-saints"],
  ["Sydney Swans", "sydney-swans"],
  ["West Coast Eagles", "west-coast-eagles"],
  ["Western Bulldogs", "western-bulldogs"],
]);

/**
 * Convert a canonical team name to a FootyWire URL slug.
 *
 * @param teamName - Canonical team name (e.g. "Hawthorn").
 * @returns The FootyWire slug or undefined if not found.
 */
function teamNameToFootyWireSlug(teamName: string): string | undefined {
  return FOOTYWIRE_SLUG_MAP.get(teamName);
}

/** Normalise a raw DOB string (e.g. "7 Oct 1995") to ISO format ("1995-10-07"). */
function normaliseDob(raw: string): string | null {
  if (!raw) return null;
  const parsed = parseDate(raw);

  if (parsed) return parsed.toISOString().slice(0, 10);

  return raw; // Return raw string as fallback if parsing fails
}

/**
 * Parse FootyWire team history HTML into player detail objects.
 *
 * The team history page (`th-TEAM`) has a table with columns:
 * No, Surname, First Name, Games, Age, DOB, Height, Origin, Pos1, Pos2
 *
 * @param html - Raw HTML from the FootyWire team history page.
 * @param teamName - Canonical team name.
 * @returns Array of player details.
 */
function parseFootyWirePlayerList(
  html: string,
  teamName: string,
): Omit<PlayerDetails, "source" | "competition">[] {
  const $ = parseHtml(html);
  const players: Omit<PlayerDetails, "source" | "competition">[] = [];

  // The R package finds the table whose first row contains "Age".
  // Columns: No(0), Name(1), Games(2), Age(3), Date of Birth(4), Height(5), Origin(6), Position(7)
  // Name is "Surname, FirstName" format.
  const dataTable = $("table")
    .filter((_i, table) => {
      const firstRow = $(table).find("tr").first();
      const cells = firstRow.find("td, th");
      // Match the R package: look for a row with an "Age" cell specifically
      const cellTexts = cells.map((_j, c) => $(c).text().trim()).get();

      return cellTexts.includes("Age") && cellTexts.includes("Name");
    })
    .first();

  if (dataTable.length === 0) return players;

  dataTable.find("tr").each((_rowIdx, row) => {
    const cells = $(row).find("td");

    if (cells.length < 6) return;

    const jumperText = $(cells[0]).text().trim();
    const nameText = $(cells[1]).text().trim();
    const gamesText = $(cells[2]).text().trim();
    const dobText = cells.length > 4 ? $(cells[4]).text().trim() : "";
    const heightText = cells.length > 5 ? $(cells[5]).text().trim() : "";
    const origin = cells.length > 6 ? $(cells[6]).text().trim() : "";
    const position = cells.length > 7 ? $(cells[7]).text().trim() : "";

    // Name is "Surname, FirstName" — split and handle "\nR" suffix (R package strips this)
    const cleanedName = nameText.replace(/\nR$/, "").trim();

    if (!cleanedName || cleanedName === "Name") return;

    const nameParts = cleanedName.split(",").map((s) => s.trim());
    const surname = nameParts[0] ?? "";
    const givenName = nameParts[1] ?? "";

    const jumperNumber = safeInt(jumperText);
    const gamesPlayed = safeInt(gamesText);
    const heightMatch = /(\d+)cm/.exec(heightText);
    const heightCm = safeInt(heightMatch?.[1] ?? "");

    players.push({
      playerId: `FW_${teamName}_${surname}_${givenName}`.replace(/\s+/g, "_"),
      givenName,
      surname,
      displayName: givenName ? `${givenName} ${surname}` : surname,
      team: teamName,
      jumperNumber,
      position: position || null,
      dateOfBirth: normaliseDob(dobText),
      heightCm,
      weightKg: null,
      gamesPlayed,
      goals: null,
      draftYear: null,
      draftPosition: null,
      draftType: null,
      debutYear: null,
      recruitedFrom: origin || null,
    });
  });

  return players;
}
