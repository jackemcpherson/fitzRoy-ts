/** Source-grounded match coach readers. */

import { Context, Effect, Layer, Result, Schema } from "effect";
import { batched } from "../lib/batched";
import { ScrapeError } from "../lib/errors";
import { readText, SourceHttp } from "../lib/http";
import { parseHtml } from "../lib/parse-html";
import { AFL_SENIOR_TEAMS, normaliseTeamName } from "../lib/team-mapping";
import type {
  CompetitionCode,
  MatchCoachAssignment,
  MatchCoachesQuery,
  MatchCoachesResult,
  MatchCoachFailure,
} from "../types";

const INDEX_URL = "https://afltables.com/afl/stats/coaches/coaches_idx.html";

const AFL_TABLES_ORIGIN = "https://afltables.com";

const FOOTYWIRE_ORIGIN = "https://www.footywire.com";

/** A FootyWire match whose page names both coaches. */
export interface FootyWireCoachMatch {
  readonly competition: CompetitionCode;
  readonly season: number;
  readonly matchId: string;
  readonly date: Date;
  readonly homeTeam: string;
  readonly awayTeam: string;
  readonly homePoints: number | null;
  readonly awayPoints: number | null;
  readonly roundName: string | null;
}

/** Coach-profile pages selected for a season, keyed by URL. */
interface CoachPage {
  readonly name: string;
  readonly url: string;
}

/** Fetch and parse match-coach assignments from AFL Tables or FootyWire. */
export class MatchCoaches extends Context.Service<
  MatchCoaches,
  {
    /** Fetch AFL Tables coach profile records and retain per-profile failures. */
    readonly fetchAflTablesSeason: (
      season: number,
      batch?: MatchCoachesQuery["batch"],
    ) => Effect.Effect<
      {
        assignments: MatchCoachAssignment[];
        failures: MatchCoachFailure[];
        batch?: MatchCoachesResult["batch"];
      },
      ScrapeError
    >;
    /** Read coach headings from FootyWire match pages for a season. */
    readonly fetchFootyWireMatches: (matches: readonly FootyWireCoachMatch[]) => Effect.Effect<{
      assignments: MatchCoachAssignment[];
      failures: MatchCoachFailure[];
    }>;
  }
>()("fitzroy/MatchCoaches") {}

/** The live match-coach reader over {@link SourceHttp}. */
export const MatchCoachesLive = Layer.effect(
  MatchCoaches,
  Effect.gen(function* () {
    const http = yield* SourceHttp;

    /** Read a page under the shared source request policy. */
    const readPage = (url: string, source: "afl-tables" | "footywire") =>
      Effect.gen(function* () {
        const response = yield* http.request(url, { headers: { "User-Agent": "Mozilla/5.0" } });

        if (!response.ok)
          return yield* Effect.fail(
            new ScrapeError({
              message: `${source} request failed: ${response.status} (${url})`,
              source,
            }),
          );

        return yield* readText(response);
      }).pipe(
        Effect.catchTag("RequestError", (error) =>
          Effect.fail(
            new ScrapeError({ message: `${source} request failed: ${error.message}`, source }),
          ),
        ),
      );

    return {
      fetchAflTablesSeason: (season, batch) =>
        Effect.gen(function* () {
          if (
            batch?.limit !== undefined &&
            (!Number.isInteger(batch.limit) || batch.limit < 1 || batch.limit > 5)
          )
            return yield* Effect.fail(
              new ScrapeError({
                message: "Batch limit must be between one and five profiles",
                source: "afl-tables",
              }),
            );

          const coaches = new Map<string, CoachPage>();

          if (batch?.cursor) {
            const cursor = decodeCursor(batch.cursor, season);

            if (Result.isFailure(cursor))
              return yield* Effect.fail(
                new ScrapeError({
                  message: "Invalid season-specific coaching cursor",
                  source: "afl-tables",
                }),
              );

            for (const page of cursor.success.pages) coaches.set(page.url, page);
          } else {
            const index = yield* readPage(INDEX_URL, "afl-tables");

            for (const page of parseAflTablesCoachIndex(index)) coaches.set(page.url, page);

            if (coaches.size === 0)
              return yield* Effect.fail(
                new ScrapeError({
                  message: "AFL Tables coach index contained no coach profiles",
                  source: "afl-tables",
                }),
              );
          }

          const selected = batch
            ? [...coaches.values()].slice(0, batch.limit ?? 5)
            : [...coaches.values()];

          const profiles = yield* batched(
            selected,
            (coach) =>
              Effect.result(readPage(coach.url, "afl-tables")).pipe(
                Effect.map((page) => ({ coach, page })),
              ),
            { batchSize: 5 },
          );

          const assignments: MatchCoachAssignment[] = [];
          const failures: MatchCoachFailure[] = [];

          for (const { coach, page } of profiles) {
            if (Result.isFailure(page)) {
              failures.push({
                url: coach.url,
                reason: page.failure.message,
                scope: `coach:${coach.name}`,
              });
              continue;
            }

            const parsed = parseAflTablesCoachProfile(page.success, coach, season);
            assignments.push(...parsed.assignments);

            if (parsed.malformed)
              failures.push({
                url: coach.url,
                reason: "Coach profile has no usable Games Coached rows",
                scope: `coach:${coach.name}`,
                coachId: `afl-tables:${coach.url}`,
              });
          }

          if (
            !batch &&
            profiles.length > 0 &&
            assignments.length === 0 &&
            failures.length === profiles.length
          )
            return yield* Effect.fail(
              new ScrapeError({
                message: "Every AFL Tables coach profile failed",
                source: "afl-tables",
              }),
            );

          if (batch) {
            const failed = new Set(failures.map((failure) => failure.url));

            const remaining = [...coaches.values()]
              .slice(selected.length)
              .concat(selected.filter((page) => failed.has(page.url)));

            return {
              assignments,
              failures,
              batch: {
                scope: "pages",
                nextCursor: remaining.length ? JSON.stringify({ season, pages: remaining }) : null,
                completedCoachIds: selected
                  .filter((page) => !failed.has(page.url))
                  .map((page) => `afl-tables:${page.url}`),
              },
            };
          }

          return { assignments, failures };
        }),

      fetchFootyWireMatches: (matches) =>
        Effect.gen(function* () {
          const pages = yield* batched(
            matches,
            (match) => {
              const providerId = match.matchId.replace(/^FW_/, "");
              const url = footyWireMatchUrl(providerId);

              return Effect.result(readPage(url, "footywire")).pipe(
                Effect.map((page) => ({ match, url, page })),
              );
            },
            { batchSize: 5 },
          );

          const assignments: MatchCoachAssignment[] = [];
          const failures: MatchCoachFailure[] = [];

          for (const { match, url, page } of pages) {
            if (Result.isFailure(page)) {
              failures.push({
                url,
                reason: page.failure.message,
                scope: `match:${match.matchId}`,
                matchId: `footywire:${match.matchId}`,
              });
              continue;
            }

            const parsed = parseFootyWireMatchCoaches(page.success, match, url);
            assignments.push(...parsed.assignments);

            if (parsed.incomplete)
              failures.push({
                url,
                reason: "Missing or ambiguous coach attribution for one or both participants",
                scope: `match:${match.matchId}`,
                matchId: `footywire:${match.matchId}`,
              });
          }

          return { assignments, failures };
        }),
    };
  }),
);

/** Assignments read from one FootyWire match page. */
interface ParsedMatchPage {
  readonly assignments: MatchCoachAssignment[];
  /** True unless exactly one coach is credited to each participant. */
  readonly incomplete: boolean;
}

/** Assignments read from one AFL Tables coach profile. */
interface ParsedCoachProfile {
  readonly assignments: MatchCoachAssignment[];
  /** True when the profile had no usable Games Coached rows. */
  readonly malformed: boolean;
}

/** Coach profile links from the AFL Tables coach index, in page order. */
function parseAflTablesCoachIndex(html: string): CoachPage[] {
  const $ = parseHtml(html);
  const pages: CoachPage[] = [];
  $("a[href]").each((_index, element) => {
    const href = $(element).attr("href");
    const name = $(element).text().trim();

    // Non-profile navigation links are outside the request scope.
    if (!href || !name || !URL.canParse(href, INDEX_URL)) return;
    const url = new URL(href, INDEX_URL);

    if (
      url.origin === AFL_TABLES_ORIGIN &&
      // The captured index also links club pages in this directory.
      // Coach profile filenames contain both names separated by an underscore.
      /^\/afl\/stats\/coaches\/[\w-]+_[\w-]+\.html$/.test(url.pathname) &&
      !url.pathname.endsWith("coaches_idx.html")
    )
      pages.push({ name, url: url.href });
  });

  return pages;
}

/**
 * Coach assignments credited on one FootyWire match page.
 *
 * `incomplete` is true unless exactly one coach is credited to each
 * participant; a team credited twice is ambiguous and keeps no assignment.
 */
function parseFootyWireMatchCoaches(
  html: string,
  match: FootyWireCoachMatch,
  url: string,
): ParsedMatchPage {
  const $ = parseHtml(html);
  const seen = new Set<string>();
  const assignments: MatchCoachAssignment[] = [];
  const creditedTeams = new Set<string>();
  const ambiguousTeams = new Set<string>();
  $("a[href*='/cp-']").each((_index, anchor) => {
    const coachName = $(anchor).text().trim();
    const href = $(anchor).attr("href");

    if (!coachName || !href || seen.has(href) || !URL.canParse(href, FOOTYWIRE_ORIGIN)) return;
    const coachUrl = new URL(href, FOOTYWIRE_ORIGIN).href;

    let team = "";
    const row = $(anchor).closest("tr");
    const rowText = row.text().replace(/\s+/g, " ").trim().toLowerCase();

    const participants = [match.homeTeam, match.awayTeam].filter((name) =>
      rowText.includes(name.toLowerCase()),
    );

    if (participants.length === 1) team = participants[0] ?? "";

    if (!team) return;
    seen.add(href);

    const parsed = decodeAssignment({
      competition: match.competition,
      season: match.season,
      team,
      coachId: `footywire:${coachUrl}`,
      coachName,
      coachUrl,
      matchId: `footywire:${match.matchId}`,
      matchUrl: url,
      date: match.date.toISOString().slice(0, 10),
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      homePoints: match.homePoints,
      awayPoints: match.awayPoints,
      roundName: match.roundName,
      source: "footywire",
    });

    if (Result.isSuccess(parsed) && creditedTeams.has(team)) ambiguousTeams.add(team);

    if (Result.isSuccess(parsed) && !creditedTeams.has(team)) {
      assignments.push(parsed.success);
      creditedTeams.add(team);
    }
  });

  return {
    assignments: assignments.filter((assignment) => !ambiguousTeams.has(assignment.team)),
    incomplete: creditedTeams.size !== 2 || ambiguousTeams.size > 0,
  };
}

/** True when a URL is an AFL Tables coach profile page (not the index). */
function isAflTablesCoachProfileUrl(url: string): boolean {
  if (!URL.canParse(url)) return false;
  const parsed = new URL(url);

  return (
    parsed.origin === AFL_TABLES_ORIGIN &&
    /^\/afl\/stats\/coaches\/[\w-]+_[\w-]+\.html$/.test(parsed.pathname) &&
    !parsed.pathname.endsWith("coaches_idx.html")
  );
}

/** True when a `YYYY-MM-DD` string names a real calendar date. */
function isCalendarDate(value: string): boolean {
  const date = new Date(`${value}T00:00:00Z`);

  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

const NonEmptyString = Schema.String.check(Schema.isMinLength(1));

const UrlString = Schema.String.check(Schema.makeFilter((url: string) => URL.canParse(url)));

const IsoDateString = Schema.String.check(
  Schema.isPattern(/^\d{4}-\d{2}-\d{2}$/),
  Schema.makeFilter(isCalendarDate),
);

const Points = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0));

const CoachTeamSchema = Schema.String.check(
  Schema.makeFilter(
    (team: string) => AFL_SENIOR_TEAMS.has(team) || team === "Brisbane Bears" || team === "Fitzroy",
  ),
);

const AssignmentSchema = Schema.Struct({
  competition: Schema.Literal("AFLM"),
  season: Schema.Int.check(Schema.isGreaterThanOrEqualTo(1990)),
  team: CoachTeamSchema,
  coachId: NonEmptyString,
  coachName: NonEmptyString,
  coachUrl: UrlString,
  matchId: NonEmptyString,
  matchUrl: UrlString,
  date: Schema.NullOr(IsoDateString),
  homeTeam: Schema.NullOr(CoachTeamSchema),
  awayTeam: Schema.NullOr(CoachTeamSchema),
  homePoints: Schema.NullOr(Points),
  awayPoints: Schema.NullOr(Points),
  roundName: Schema.NullOr(NonEmptyString),
  source: Schema.Literals(["afl-tables", "footywire"]),
}).check(
  Schema.makeFilter(
    (row) =>
      row.homeTeam !== row.awayTeam && (row.team === row.homeTeam || row.team === row.awayTeam),
    { message: "Invalid participants" },
  ),
  Schema.makeFilter((row) => {
    const origin = row.source === "afl-tables" ? AFL_TABLES_ORIGIN : FOOTYWIRE_ORIGIN;

    return new URL(row.coachUrl).origin === origin && new URL(row.matchUrl).origin === origin;
  }),
);

const decodeAssignment = Schema.decodeUnknownResult(AssignmentSchema);

/** Decode a season-specific batch cursor without throwing. */
function decodeCursor(cursor: string, season: number) {
  const CursorSchema = Schema.Struct({
    season: Schema.Literal(season),
    pages: Schema.Array(
      Schema.Struct({
        name: NonEmptyString,
        url: UrlString.check(Schema.makeFilter(isAflTablesCoachProfileUrl)),
      }),
    ).check(Schema.isMaxLength(1000)),
  });

  return Schema.decodeUnknownResult(Schema.fromJsonString(CursorSchema))(cursor);
}

function parseAflTablesCoachProfile(
  html: string,
  coach: { name: string; url: string },
  season: number,
): ParsedCoachProfile {
  const $ = parseHtml(html);
  const assignments: MatchCoachAssignment[] = [];
  let hadGameRows = false;
  let malformed = false;
  $("tr").each((_index, row) => {
    const gameLink = $(row).find('a[href*="/games/"]').first();
    const href = gameLink.attr("href");

    if (!href) return;
    hadGameRows = true;

    if (!URL.canParse(href, coach.url)) {
      malformed = true;

      return;
    }

    const matchUrl = new URL(href, coach.url);

    const game = /\/stats\/games\/(\d{4})\/\d{4}(\d{4})(\d{2})(\d{2})\.html$/.exec(
      matchUrl.pathname,
    );

    if (!game || matchUrl.origin !== AFL_TABLES_ORIGIN) {
      malformed = true;

      return;
    }

    if (Number(game[1]) !== season) return;
    const cells = $(row).children("td").toArray();
    const text = (index: number) => (cells[index] ? $(cells[index]).text().trim() : "");
    // Games Coached puts the coached club first, regardless of venue orientation.
    // Consumers reconcile these participant/score pairs in either orientation.
    const team = normaliseTeamName(text(3));
    const opponent = normaliseTeamName(text(6));

    const parsed = decodeAssignment({
      competition: "AFLM",
      season,
      team,
      coachId: `afl-tables:${coach.url}`,
      coachName: $("h1").first().text().trim() || coach.name,
      coachUrl: coach.url,
      matchId: `afl-tables:${matchUrl.href}`,
      matchUrl: matchUrl.href,
      date: `${game[2]}-${game[3]}-${game[4]}`,
      homeTeam: team,
      awayTeam: opponent,
      homePoints: text(5) ? Number(text(5)) : NaN,
      awayPoints: text(8) ? Number(text(8)) : NaN,
      roundName: gameLink.text().trim(),
      source: "afl-tables",
    });

    if (Result.isFailure(parsed) || game[1] !== game[2]) {
      malformed = true;

      return;
    }

    assignments.push(parsed.success);
  });

  return { assignments, malformed: malformed || !hadGameRows };
}

/** Build stable provider URLs used by the FootyWire capability. */
export function footyWireMatchUrl(providerMatchId: string): string {
  return `${FOOTYWIRE_ORIGIN}/afl/footy/ft_match_statistics?mid=${encodeURIComponent(providerMatchId)}`;
}

export { AFL_TABLES_ORIGIN };
