/**
 * Smoke test: fitzRoy-ts (local, post-refactor) vs MCP D1 database.
 *
 * Hits the live AFL API via the refactored library and prints stable
 * comparison points that can be checked against equivalent SQL on the
 * MCP. Picks 2024 (historical, immutable) data so results don't drift.
 */

import { fetchLadder, fetchMatches, fetchPlayerStats } from "../src/index";

function jprint(label: string, value: unknown): void {
  console.log(`\n=== ${label} ===`);
  console.log(JSON.stringify(value, null, 2));
}

const matchesR = await fetchMatches({
  source: "afl-api",
  season: 2024,
  round: 1,
  competition: "AFLM",
});
if (!matchesR.success) {
  console.error("fetchMatches failed:", matchesR.error.message);
  process.exit(1);
}
const matchesSummary = matchesR.data.map((m) => ({
  date: m.date instanceof Date ? m.date.toISOString().slice(0, 10) : m.date,
  home: m.homeTeam,
  away: m.awayTeam,
  home_points: m.homePoints,
  away_points: m.awayPoints,
  margin: m.margin,
}));
jprint("2024 Round 1 matches (count + summary)", {
  count: matchesSummary.length,
  matches: matchesSummary,
});

const ladderR = await fetchLadder({
  source: "afl-api",
  season: 2024,
  round: 24,
  competition: "AFLM",
});
if (!ladderR.success) {
  console.error("fetchLadder failed:", ladderR.error.message);
  process.exit(1);
}
const top4 = ladderR.data.entries.slice(0, 4).map((e) => ({
  position: e.position,
  team: e.team,
  played: e.played,
  wins: e.wins,
  losses: e.losses,
  draws: e.draws,
  pts: e.premiershipPoints,
  pct: e.percentage,
}));
jprint("2024 ladder top 4 after R24", top4);

const statsR = await fetchPlayerStats({
  source: "afl-api",
  season: 2024,
  round: 1,
  competition: "AFLM",
});
if (!statsR.success) {
  console.error("fetchPlayerStats failed:", statsR.error.message);
  process.exit(1);
}
const totalGoals = statsR.data.reduce((sum, s) => sum + (s.goals ?? 0), 0);
const topScorers = [...statsR.data]
  .filter((s) => (s.goals ?? 0) > 0)
  .sort((a, b) => (b.goals ?? 0) - (a.goals ?? 0))
  .slice(0, 5)
  .map((s) => ({ player: s.displayName, team: s.team, goals: s.goals }));
jprint("2024 Round 1 player stats", {
  rowCount: statsR.data.length,
  totalGoals,
  topScorers,
});
