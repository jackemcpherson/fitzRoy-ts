/**
 * Fixture-backed `fetch` for the golden characterisation tests.
 *
 * Routes each requested URL to a committed fixture, answers unmatched URLs
 * with 404, and records every URL so tests can snapshot the request set.
 * The CLI golden test also preloads this module into a subprocess.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const FIXTURES = resolve(import.meta.dirname, "../fixtures");

const fixtureCache = new Map<string, string>();

/** Read a fixture once; later requests for it reuse the text. */
function fixture(name: string): string {
  const cached = fixtureCache.get(name);

  if (cached !== undefined) return cached;
  const text = readFileSync(resolve(FIXTURES, name), "utf-8");

  fixtureCache.set(name, text);

  return text;
}

interface Capture {
  readonly file: string;
  readonly url: string;
}

/** Exact URLs of the captured AFL Tables coach profiles. */
const COACH_CAPTURES: readonly Capture[] = JSON.parse(fixture("match-coaches/captures.json"));

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** URL pattern → fixture file. First match wins; unmatched URLs return 404. */
const ROUTES: ReadonlyArray<readonly [RegExp, string]> = [
  ...COACH_CAPTURES.map(
    (capture) =>
      [new RegExp(`^${escapeRegExp(capture.url)}$`), `match-coaches/${capture.file}`] as const,
  ),
  [/WMCTok/, "@token"],
  [/aflapi\.afl\.com\.au\/afl\/v2\/competitions\/1\/compseasons/, "afl-api-compseasons-2024.json"],
  [/aflapi\.afl\.com\.au\/afl\/v2\/competitions\/\d+\/compseasons/, "aflw-provider-seasons.json"],
  [/\/compseasons\/\d+\/rounds/, "afl-api-rounds-2024.json"],
  [/\/compseasons\/\d+\/ladders/, "afl-api-ladder-2024-r10.json"],
  [/\/teams\?/, "afl-api-teams-aflm.json"],
  [/\/squads\?/, "afl-api-squads-carlton-2024.json"],
  [/\/matchItems\/round\//, "afl-api-round-1-2025.json"],
  [/\/playerStats\/match\//, "afl-api-player-stats-2025.json"],
  [/\/matchRoster\/full\//, "afl-api-match-roster-2025.json"],
  [/footywire\.com\/afl\/footy\/ft_match_list/, "footywire-match-list.html"],
  [/footywire\.com\/afl\/footy\/ft_team_rankings\?.*type=T/, "footywire-team-stats.html"],
  [/footywire\.com\/afl\/footy\/ft_team_rankings\?.*type=O/, "footywire-team-stats-opp.html"],
  [
    /footywire\.com\/afl\/footy\/ft_match_statistics\?.*advv=Y/,
    "footywire-match-stats-advanced-11174.html",
  ],
  [/footywire\.com\/afl\/footy\/ft_match_statistics/, "footywire-match-stats-basic-11174.html"],
  [/afltables\.com\/afl\/seas\/\d{4}\.html/, "afl-tables-season.html"],
  [/afltables\.com\/afl\/stats\/\d{4}s\.html/, "afl-tables-team-stats.html"],
  [/afltables\.com\/afl\/stats\/games\//, "afltables-game-stats-2024-r1.html"],
  [/afltables\.com\/afl\/stats\/coaches\/coaches_idx\.html/, "match-coaches/afl-tables-index.html"],
  [/api\.squiggle\.com\.au\/\?q=games/, "squiggle-games-2024-r1.json"],
  [/api\.squiggle\.com\.au\/\?q=standings/, "squiggle-standings-2024-r10.json"],
  [/aflcoaches\.com\.au/, "afl-coaches-votes.html"],
  [/fryziggafl\.net\/.*\.rds$/, "@rds"],
];

/** Every URL requested since the last {@link resetRequested} call. */
export const requested: string[] = [];

/** Clear the recorded URLs. */
export function resetRequested(): void {
  requested.length = 0;
}

/** Answer a request from the fixture routes. */
export function goldenFetch(input: string | URL | Request): Promise<Response> {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  requested.push(url);
  const route = ROUTES.find(([pattern]) => pattern.test(url));

  if (!route) return Promise.resolve(new Response("not found", { status: 404 }));

  if (route[1] === "@token") {
    return Promise.resolve(
      new Response(JSON.stringify({ token: "golden-token" }), { status: 200 }),
    );
  }

  if (route[1] === "@rds") {
    return Promise.resolve(new Response(readFileSync(resolve(FIXTURES, "fryzigg-sample.rds"))));
  }

  return Promise.resolve(new Response(fixture(route[1]), { status: 200 }));
}
