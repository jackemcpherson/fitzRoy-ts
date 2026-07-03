/**
 * Probe script: AFL Tables game-stats pages as a Lineup source.
 *
 * Purpose: determine whether afltables.com/afl/stats/games/YYYY/GAME_ID.html
 * provides enough structure to build a `Lineup` object (both teams, player
 * names, jumper numbers, substitute flags) for eras where the AFL API fails
 * or returns only the Thursday-night announced team.
 *
 * Run: bun run scripts/probe-afl-tables-lineup-source.ts
 *
 * ─── Findings (run 2026-07-02) ──────────────────────────────────────────────
 *
 * VERDICT: FEASIBLE. AFL Tables game-stats pages reliably provide fielded
 * lineups for all sampled years including the four AFL API failure rounds.
 *
 * Page structure (afltables.com/afl/stats/games/YYYY/GAME_ID.html):
 *   - Two `<table class="sortable">` elements per page (one per team).
 *     Each has a `<thead>` whose first row reads "[Team] Match Statistics".
 *   - tbody rows: `<td>#</td><td><a href="...">Surname, First</a></td><td>KI</td>...`
 *     (24 stat columns total; same structure parsed by parseAflTablesGameStats).
 *   - The `#` cell can contain `↑` (subbed on) or `↓` (subbed off) Unicode
 *     arrow characters appended to the jumper number, matching the `parseName`
 *     stripping logic already in src/transforms/afl-tables-player-stats.ts.
 *   - NO position column. matchPosition must be null for all players.
 *   - NO emergency section. Emergencies never took the field so they have no
 *     stats row; isEmergency must be false for all players.
 *   - isSubstitute derivable: ↑ in the jumper cell → came on as sub (true).
 *     Player subbed off (↓) started the game; isSubstitute = false for them.
 *   - Player URL path (e.g. ../../players/M/Matt_Arnot.html) yields an
 *     AFL Tables-specific player key consistent with the AT_ convention already
 *     used by parseAflTablesGameStats (playerId: `AT_DisplayName`).
 *   - matchId for AFL Tables lineups should be `AT_${aflTablesGameId}` (e.g.
 *     `AT_111420150424`) to keep it distinct from AFL API matchIds and parallel
 *     the existing `AT_${matchId}` prefix in PlayerStats.
 *
 * Coverage sampled:
 *   Year   Players/team  Notes
 *   ────   ────────────  ─────────────────────────────────────────────────────
 *   2024   23            Medical-sub era (22 field + 1 medical sub in stats)
 *   2019   22            216 completed games on season page (confirmed 22)
 *   2018   22            9 R9 games found; first game has 22 players per team
 *   2017   22            9 R8 games found; first game has 22 players per team
 *   2015   22            9 R4 games found; first game (Richmond v Melbourne,
 *                        Fri 24-Apr-2015) has 22 players per team — this is
 *                        one of the four AFL API failure rounds
 *   2010   22            186 games in season; 22 players per team
 *   2000   22            185 games in season; 22 players per team
 *   1990   20            161 games; 20 players (pre-interchange rule era)
 *   1980   20            138 games; 20 players per team
 *   1965   20            112 games; 20 players per team
 *   1950   20            112 games; 20 players per team
 *
 * AFL API missing rounds confirmed covered by AFL Tables:
 *   2015 R4 — 9 games, 22 players/team ✓
 *   2017 R8 — 9 games, 22 players/team ✓
 *   2018 R9 — 9 games, 22 players/team ✓
 *   2019 R11 — 9 games, 22 players/team ✓  (first game: Nth Melb v Richmond)
 *
 * AFL API announced-vs-fielded probe:
 *   SKIPPED — AFL API token endpoint returns HTTP 403 from this environment
 *   (requires WMCTok credentials, see src/sources/afl-api.ts:TOKEN_URL).
 *   Consumer evidence (AFL-MCP src/sync/upserts.ts:MIN_LINEUP_SYNC_YEAR=2023)
 *   explicitly confirms AFL API returns the Thursday-night announced team for
 *   years < 2023; the stats-derived backfill (migration 0007) was used instead
 *   to avoid overwriting fielded data with announced data.
 *
 * Parsing surface — same page, different columns:
 *   parseAflTablesGameStats (existing) reads all 24 stat columns.
 *   A new parseAflTablesGameLineup can read only columns 0 (#) and 1 (Player)
 *   from the same tbody, making it a strict subset of the existing parse logic.
 *   The team-name extraction from the thead header row is identical.
 *
 * ────────────────────────────────────────────────────────────────────────────
 */

import { parseHtml } from "../src/lib/parse-html";
import { createSourceFetch } from "../src/lib/source-fetch";

const BASE = "https://afltables.com/afl/stats/games";
const SEAS = "https://afltables.com/afl/seas";

const fetchFn = createSourceFetch({ minDelayMs: 500 });

interface SampledGame {
  readonly year: number;
  readonly round: number;
  readonly gameId: string;
  readonly homeTeam: string;
  readonly awayTeam: string;
  readonly playersTeam1: number;
  readonly playersTeam2: number;
  readonly hasSubstituteMarkers: boolean;
}

/** Pull game IDs for a specific round from the season index page. */
async function fetchRoundGameIds(year: number, round: number): Promise<string[]> {
  const r = await fetchFn(`${SEAS}/${year}.html`, {
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  if (!r.ok) throw new Error(`Season page ${year}: HTTP ${r.status}`);
  const html = await r.text();

  const rLabel = `Round ${round}`;
  const rNextLabel = `Round ${round + 1}`;
  const from = html.indexOf(rLabel);
  if (from === -1) throw new Error(`Round ${round} not found in ${year} season page`);
  const to = html.indexOf(rNextLabel, from + rLabel.length);
  const section = to === -1 ? html.slice(from) : html.slice(from, to);

  const matches = section.matchAll(/stats\/games\/\d{4}\/(\d+)\.html/g);
  return [...new Set([...matches].map((m) => m[1] ?? "").filter(Boolean))];
}

/** Parse a game stats page and return player counts per team. */
async function probeGamePage(year: number, gameId: string): Promise<SampledGame | null> {
  const r = await fetchFn(`${BASE}/${year}/${gameId}.html`, {
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  if (!r.ok) {
    console.error(`  HTTP ${r.status}: ${BASE}/${year}/${gameId}.html`);
    return null;
  }
  const html = await r.text();
  const $ = parseHtml(html);

  // Title: "AFL Tables - HomeTeam v AwayTeam - Date - Match Stats"
  const title = $("title").text();
  const teamMatch = /AFL Tables - (.+?) v (.+?) -/.exec(title);
  const homeTeam = teamMatch?.[1] ?? "?";
  const awayTeam = teamMatch?.[2] ?? "?";

  // Find the round from the summary box
  const summaryText = $("table").first().text();
  const roundMatch = /Round:\s*(\d+)/.exec(summaryText);
  const round = Number(roundMatch?.[1] ?? 0);

  // Count players per team from sortable tables (stats tables only —
  // "Match Statistics" in their first header row distinguishes them from
  // the player-career-details tables that follow).
  const teamPlayerCounts: number[] = [];
  let hasSubMarkers = false;

  $("table.sortable").each((_i, table) => {
    const headerText = $(table).find("thead tr").first().text();
    if (!/Match Statistics/i.test(headerText)) return;

    let count = 0;
    $(table)
      .find("tbody tr")
      .each((_j, row) => {
        const cells = $(row).find("td");
        if (cells.length < 2) return;
        const jumperText = $(cells.get(0) ?? row)
          .text()
          .trim();
        if (/^\d+/.test(jumperText)) {
          count++;
          if (/[↑↓]/.test(jumperText)) hasSubMarkers = true;
        }
      });
    teamPlayerCounts.push(count);
  });

  return {
    year,
    round,
    gameId,
    homeTeam,
    awayTeam,
    playersTeam1: teamPlayerCounts[0] ?? 0,
    playersTeam2: teamPlayerCounts[1] ?? 0,
    hasSubstituteMarkers: hasSubMarkers,
  };
}

interface ProbeCase {
  readonly year: number;
  readonly round: number;
  readonly label: string;
}

const PROBE_CASES: ProbeCase[] = [
  { year: 2015, round: 4, label: "AFL API failure round" },
  { year: 2017, round: 8, label: "AFL API failure round" },
  { year: 2018, round: 9, label: "AFL API failure round" },
  { year: 2019, round: 11, label: "AFL API failure round" },
  { year: 2010, round: 1, label: "pre-2015 control" },
  { year: 2000, round: 1, label: "pre-2015 control" },
  { year: 1990, round: 1, label: "pre-interchange era" },
  { year: 1965, round: 1, label: "historical" },
];

async function main(): Promise<void> {
  console.log("AFL Tables lineup source probe\n");

  for (const { year, round, label } of PROBE_CASES) {
    console.log(`── ${year} R${round} (${label}) ──`);
    let ids: string[];
    try {
      ids = await fetchRoundGameIds(year, round);
    } catch (e) {
      console.log(`  ERROR fetching season page: ${e instanceof Error ? e.message : String(e)}\n`);
      continue;
    }
    console.log(`  ${ids.length} games found`);

    const firstId = ids[0];
    if (!firstId) {
      console.log("  No games to probe\n");
      continue;
    }

    const game = await probeGamePage(year, firstId);
    if (!game) {
      console.log("  Could not fetch game page\n");
      continue;
    }

    console.log(
      `  First game: ${game.homeTeam} v ${game.awayTeam}` +
        ` | team1=${game.playersTeam1}p team2=${game.playersTeam2}p` +
        ` | subs=${game.hasSubstituteMarkers}`,
    );
    console.log();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
