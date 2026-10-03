/** Source-grounded match coach readers. */

import { z } from "zod";
import { batchedMap } from "../lib/concurrency";
import { ScrapeError } from "../lib/errors";
import { parseHtml } from "../lib/parse-html";
import { err, ok, type Result } from "../lib/result";
import { createSourceFetch, type SourceFetchOptions } from "../lib/source-fetch";
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

interface FootyWireCoachMatch {
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

/** Fetch and parse match-coach assignments from AFL Tables or FootyWire. */
export class MatchCoachesClient {
  private readonly fetchFn: typeof fetch;

  constructor(options?: SourceFetchOptions) {
    this.fetchFn = createSourceFetch(options);
  }

  /** Fetch AFL Tables coach profile records and retain per-profile failures. */
  async fetchAflTablesSeason(
    season: number,
    batch?: MatchCoachesQuery["batch"],
  ): Promise<
    Result<
      {
        assignments: MatchCoachAssignment[];
        failures: MatchCoachFailure[];
        batch?: MatchCoachesResult["batch"];
      },
      ScrapeError
    >
  > {
    const coaches = new Map<string, { name: string; url: string }>();
    const cursorSchema = z.object({
      season: z.literal(season),
      pages: z
        .array(
          z.object({
            name: z.string().min(1),
            url: z.url().refine((url) => {
              const parsed = new URL(url);
              return (
                parsed.origin === AFL_TABLES_ORIGIN &&
                /^\/afl\/stats\/coaches\/[\w-]+_[\w-]+\.html$/.test(parsed.pathname) &&
                !parsed.pathname.endsWith("coaches_idx.html")
              );
            }),
          }),
        )
        .max(1000),
    });
    if (
      batch?.limit !== undefined &&
      (!Number.isInteger(batch.limit) || batch.limit < 1 || batch.limit > 5)
    )
      return err(
        new ScrapeError("Batch limit must be between one and five profiles", "afl-tables"),
      );
    if (batch?.cursor) {
      try {
        const cursor = cursorSchema.parse(JSON.parse(batch.cursor));
        for (const page of cursor.pages) coaches.set(page.url, page);
      } catch {
        return err(new ScrapeError("Invalid season-specific coaching cursor", "afl-tables"));
      }
    } else {
      const index = await this.readPage(INDEX_URL, "afl-tables");
      if (!index.success) return index;
      const $ = parseHtml(index.data);
      $("a[href]").each((_index, element) => {
        const href = $(element).attr("href");
        const name = $(element).text().trim();
        if (!href || !name) return;
        try {
          const url = new URL(href, INDEX_URL);
          if (
            url.origin === AFL_TABLES_ORIGIN &&
            // The captured index also links club pages in this directory.
            // Coach profile filenames contain both names separated by an underscore.
            /^\/afl\/stats\/coaches\/[\w-]+_[\w-]+\.html$/.test(url.pathname) &&
            !url.pathname.endsWith("coaches_idx.html")
          )
            coaches.set(url.href, { name, url: url.href });
        } catch {
          /* Non-profile navigation links are outside the request scope. */
        }
      });
      if (coaches.size === 0)
        return err(
          new ScrapeError("AFL Tables coach index contained no coach profiles", "afl-tables"),
        );
    }
    const selected = batch
      ? [...coaches.values()].slice(0, batch.limit ?? 5)
      : [...coaches.values()];
    const profiles = await batchedMap(
      selected,
      async (coach) => {
        const page = await this.readPage(coach.url, "afl-tables");
        return { coach, page };
      },
      { batchSize: 5 },
    );
    const assignments: MatchCoachAssignment[] = [];
    const failures: MatchCoachFailure[] = [];
    for (const { coach, page } of profiles) {
      if (!page.success) {
        failures.push({ url: coach.url, reason: page.error.message, scope: `coach:${coach.name}` });
        continue;
      }
      const parsed = parseAflTablesCoachProfile(page.data, coach, season);
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
      return err(new ScrapeError("Every AFL Tables coach profile failed", "afl-tables"));
    if (batch) {
      const failed = new Set(failures.map((failure) => failure.url));
      const remaining = [...coaches.values()]
        .slice(selected.length)
        .concat(selected.filter((page) => failed.has(page.url)));
      return ok({
        assignments,
        failures,
        batch: {
          scope: "pages",
          nextCursor: remaining.length ? JSON.stringify({ season, pages: remaining }) : null,
          completedCoachIds: selected
            .filter((page) => !failed.has(page.url))
            .map((page) => `afl-tables:${page.url}`),
        },
      });
    }
    return ok({ assignments, failures });
  }

  /** Read coach headings from FootyWire match pages for a season. */
  async fetchFootyWireMatches(matches: readonly FootyWireCoachMatch[]): Promise<{
    assignments: MatchCoachAssignment[];
    failures: MatchCoachFailure[];
  }> {
    const pages = await batchedMap(
      matches,
      async (match) => {
        const providerId = match.matchId.replace(/^FW_/, "");
        const url = footyWireMatchUrl(providerId);
        return { match, url, page: await this.readPage(url, "footywire") };
      },
      { batchSize: 5 },
    );
    const assignments: MatchCoachAssignment[] = [];
    const failures: MatchCoachFailure[] = [];
    for (const { match, url, page } of pages) {
      if (!page.success) {
        failures.push({
          url,
          reason: page.error.message,
          scope: `match:${match.matchId}`,
          matchId: `footywire:${match.matchId}`,
        });
        continue;
      }
      const $ = parseHtml(page.data);
      const seen = new Set<string>();
      const firstAssignment = assignments.length;
      const creditedTeams = new Set<string>();
      const ambiguousTeams = new Set<string>();
      $("a[href*='/cp-']").each((_index, anchor) => {
        const coachName = $(anchor).text().trim();
        const href = $(anchor).attr("href");
        if (!coachName || !href || seen.has(href)) return;
        let coachUrl: string;
        try {
          coachUrl = new URL(href, FOOTYWIRE_ORIGIN).href;
        } catch {
          return;
        }
        let team = "";
        const row = $(anchor).closest("tr");
        const rowText = row.text().replace(/\s+/g, " ").trim().toLowerCase();
        const participants = [match.homeTeam, match.awayTeam].filter((name) =>
          rowText.includes(name.toLowerCase()),
        );
        if (participants.length === 1) team = participants[0] ?? "";
        if (!team) return;
        seen.add(href);
        const parsed = AssignmentSchema.safeParse({
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
        if (parsed.success && creditedTeams.has(team)) ambiguousTeams.add(team);
        if (parsed.success && !creditedTeams.has(team)) {
          assignments.push(parsed.data);
          creditedTeams.add(team);
        }
      });
      if (ambiguousTeams.size > 0) {
        const good = assignments
          .slice(firstAssignment)
          .filter((assignment) => !ambiguousTeams.has(assignment.team));
        assignments.splice(firstAssignment, assignments.length - firstAssignment, ...good);
      }
      if (creditedTeams.size !== 2 || ambiguousTeams.size > 0)
        failures.push({
          url,
          reason: "Missing or ambiguous coach attribution for one or both participants",
          scope: `match:${match.matchId}`,
          matchId: `footywire:${match.matchId}`,
        });
    }
    return { assignments, failures };
  }

  /** Read a page using the same timeout/retry/fetch injection as other sources. */
  async readPage(
    url: string,
    source: "afl-tables" | "footywire",
  ): Promise<Result<string, ScrapeError>> {
    try {
      const response = await this.fetchFn(url, { headers: { "User-Agent": "Mozilla/5.0" } });
      if (!response.ok)
        return err(
          new ScrapeError(`${source} request failed: ${response.status} (${url})`, source),
        );
      return ok(await response.text());
    } catch (cause) {
      return err(
        new ScrapeError(
          `${source} request failed: ${cause instanceof Error ? cause.message : String(cause)}`,
          source,
        ),
      );
    }
  }
}

const CoachTeamSchema = z
  .string()
  .refine((team) => AFL_SENIOR_TEAMS.has(team) || team === "Brisbane Bears" || team === "Fitzroy");
const AssignmentSchema = z
  .object({
    competition: z.literal("AFLM"),
    season: z.number().int().min(1990),
    team: CoachTeamSchema,
    coachId: z.string().min(1),
    coachName: z.string().min(1),
    coachUrl: z.url(),
    matchId: z.string().min(1),
    matchUrl: z.url(),
    date: z.iso.date().nullable(),
    homeTeam: CoachTeamSchema.nullable(),
    awayTeam: CoachTeamSchema.nullable(),
    homePoints: z.number().int().nonnegative().nullable(),
    awayPoints: z.number().int().nonnegative().nullable(),
    roundName: z.string().min(1).nullable(),
    source: z.enum(["afl-tables", "footywire"]),
  })
  .refine(
    (row) =>
      row.homeTeam !== row.awayTeam && (row.team === row.homeTeam || row.team === row.awayTeam),
    "Invalid participants",
  )
  .refine((row) => {
    const origin = row.source === "afl-tables" ? AFL_TABLES_ORIGIN : FOOTYWIRE_ORIGIN;
    return new URL(row.coachUrl).origin === origin && new URL(row.matchUrl).origin === origin;
  });

function parseAflTablesCoachProfile(
  html: string,
  coach: { name: string; url: string },
  season: number,
): { assignments: MatchCoachAssignment[]; malformed: boolean } {
  const $ = parseHtml(html);
  const assignments: MatchCoachAssignment[] = [];
  let hadGameRows = false;
  let malformed = false;
  $("tr").each((_index, row) => {
    const gameLink = $(row).find('a[href*="/games/"]').first();
    const href = gameLink.attr("href");
    if (!href) return;
    hadGameRows = true;
    let matchUrl: URL;
    try {
      matchUrl = new URL(href, coach.url);
    } catch {
      malformed = true;
      return;
    }
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
    const parsed = AssignmentSchema.safeParse({
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
    if (!parsed.success || game[1] !== game[2]) {
      malformed = true;
      return;
    }
    assignments.push(parsed.data);
  });
  return { assignments, malformed: malformed || !hadGameRows };
}

/** Build stable provider URLs used by the FootyWire capability. */
export function footyWireMatchUrl(providerMatchId: string): string {
  return `${FOOTYWIRE_ORIGIN}/afl/footy/ft_match_statistics?mid=${encodeURIComponent(providerMatchId)}`;
}

export { AFL_TABLES_ORIGIN };
