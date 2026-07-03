/**
 * Probe AFL API to fill in the spec-first capability matrix.
 *
 * Answers four questions:
 *   1. Does VFL exist in /competitions, and what's its `code`?
 *   2. Earliest seasons available for AFLM, AFLW, VFL?
 *   3. Does VFL return rich PlayerStats (kicks, marks, etc.) or just basic match info?
 *   4. What `teamType` value(s) do VFL teams use in /teams?
 *
 * Run: bun run scripts/probe-afl-api.ts
 */

import {
  CompetitionListSchema,
  CompseasonListSchema,
  MatchItemListSchema,
  PlayerStatsListSchema,
  RoundListSchema,
  TeamListSchema,
} from "../src/lib/validation";
import { AflApiClient } from "../src/sources/afl-api";

const API_BASE = "https://aflapi.afl.com.au/afl/v2";
const CFS_BASE = "https://api.afl.com.au/cfs/afl";

const client = new AflApiClient();

const delay = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

function header(s: string): void {
  console.log(`\n=== ${s} ===`);
}

function yearFromName(name: string): number | null {
  const m = name.match(/(19|20)\d{2}/);
  return m ? Number(m[0]) : null;
}

// ---------------------------------------------------------------------------
// [1] Competitions
// ---------------------------------------------------------------------------
header("[1] Competitions");

const compsResult = await client.fetchJson(
  `${API_BASE}/competitions?pageSize=100`,
  CompetitionListSchema,
);
if (!compsResult.success) {
  console.error("FATAL:", compsResult.error.message);
  process.exit(1);
}

for (const c of compsResult.data.competitions) {
  console.log(
    `  id=${String(c.id).padStart(3)}  code=${(c.code ?? "(none)").padEnd(8)}  name=${c.name}`,
  );
}

const targetCodes = ["AFL", "AFLW", "VFL", "VFLW"];
const targets = compsResult.data.competitions.filter(
  (c) => c.code !== undefined && targetCodes.includes(c.code),
);
console.log(`\n  Targets found: ${targets.map((c) => c.code).join(", ") || "(none)"}`);

// ---------------------------------------------------------------------------
// [2] Compseasons per target competition
// ---------------------------------------------------------------------------
header("[2] Compseasons per target competition");

const seasonsByComp = new Map<
  string,
  { compId: number; seasons: { id: number; name: string; year: number | null }[] }
>();

for (const comp of targets) {
  await delay(500);
  const result = await client.fetchJson(
    `${API_BASE}/competitions/${comp.id}/compseasons?pageSize=200`,
    CompseasonListSchema,
  );
  const code = comp.code ?? `id=${comp.id}`;
  if (!result.success) {
    console.log(`  ${code}: ERROR ${result.error.message}`);
    continue;
  }
  const seasons = result.data.compSeasons.map((s) => ({
    id: s.id,
    name: s.name,
    year: yearFromName(s.name),
  }));
  const years = seasons.map((s) => s.year).filter((y): y is number => y !== null);
  const min = years.length ? Math.min(...years) : null;
  const max = years.length ? Math.max(...years) : null;
  console.log(
    `  ${code.padEnd(6)} (compId=${comp.id}): seasons=${seasons.length}  earliest=${min ?? "?"}  latest=${max ?? "?"}`,
  );
  seasonsByComp.set(code, { compId: comp.id, seasons });
}

// ---------------------------------------------------------------------------
// [3] PlayerStats probe — round 1 of latest season for each target competition
// ---------------------------------------------------------------------------

function summariseFields(obj: Record<string, unknown>): { pop: string[]; nul: string[] } {
  const pop: string[] = [];
  const nul: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v === null) nul.push(k);
    else if (v !== undefined && typeof v !== "object") pop.push(k);
  }
  return { pop, nul };
}

async function probePlayerStats(code: string): Promise<void> {
  const entry = seasonsByComp.get(code);
  console.log(`\n  --- ${code} ---`);
  if (!entry || entry.seasons.length === 0) {
    console.log("  no seasons");
    return;
  }
  // Pick most recent season that's plausibly underway — try latest, fall back to earlier.
  const sortedDesc = [...entry.seasons]
    .filter((s) => s.year !== null)
    .sort((a, b) => (b.year ?? 0) - (a.year ?? 0));

  for (const season of sortedDesc.slice(0, 3)) {
    await delay(500);
    const roundsResult = await client.fetchJson(
      `${API_BASE}/compseasons/${season.id}/rounds?pageSize=50`,
      RoundListSchema,
    );
    if (!roundsResult.success) continue;
    const round1 = roundsResult.data.rounds.find((r) => r.roundNumber === 1);
    if (!round1?.providerId) continue;

    const matchesResult = await client.fetchJson(
      `${CFS_BASE}/matchItems/round/${round1.providerId}`,
      MatchItemListSchema,
    );
    if (!matchesResult.success) continue;
    const concluded = matchesResult.data.items.find(
      (m) => m.match.status === "CONCLUDED" || m.match.status === "COMPLETE",
    );
    if (!concluded) continue;

    console.log(
      `  Season ${season.year} round 1: ${concluded.match.homeTeam.name} vs ${concluded.match.awayTeam.name}`,
    );

    const statsResult = await client.fetchJson(
      `${CFS_BASE}/playerStats/match/${concluded.match.matchId}`,
      PlayerStatsListSchema,
    );
    if (!statsResult.success) {
      console.log(`  PlayerStats: ERROR ${statsResult.error.message}`);
      return;
    }
    const home = statsResult.data.homeTeamPlayerStats ?? [];
    const away = statsResult.data.awayTeamPlayerStats ?? [];
    console.log(`  PlayerStats counts: home=${home.length}, away=${away.length}`);
    const first = home[0];
    const stats = first?.playerStats?.stats as Record<string, unknown> | undefined;
    if (!stats) {
      console.log("  No playerStats.stats on first player");
      return;
    }
    const core = summariseFields(stats);
    console.log(`  Core stats populated (${core.pop.length}): ${core.pop.join(", ")}`);
    if (core.nul.length > 0) {
      console.log(`  Core stats null (${core.nul.length}): ${core.nul.join(", ")}`);
    }
    const ext = (stats as { extendedStats?: Record<string, unknown> | null }).extendedStats;
    if (ext) {
      const extSum = summariseFields(ext);
      console.log(
        `  Extended stats populated (${extSum.pop.length}/${extSum.pop.length + extSum.nul.length})`,
      );
      if (extSum.nul.length > 0 && extSum.nul.length < 10) {
        console.log(`    nulls: ${extSum.nul.join(", ")}`);
      }
    } else {
      console.log("  Extended stats: ABSENT (null or missing)");
    }
    const clearances = (stats as { clearances?: Record<string, unknown> | null }).clearances;
    console.log(`  Clearances object: ${clearances ? "present" : "absent"}`);
    return;
  }
  console.log("  No probable season with concluded round 1 found");
}

header("[3] PlayerStats probe per competition");
await delay(500);
await probePlayerStats("AFL");
await delay(500);
await probePlayerStats("AFLW");
await delay(500);
await probePlayerStats("VFL");

// ---------------------------------------------------------------------------
// [4] Teams — discover teamType taxonomy
// ---------------------------------------------------------------------------
header("[4] Teams — teamType breakdown");
await delay(500);
const teamsResult = await client.fetchJson(`${API_BASE}/teams?pageSize=500`, TeamListSchema);
if (!teamsResult.success) {
  console.log(`  ERROR: ${teamsResult.error.message}`);
} else {
  console.log(`  Total teams: ${teamsResult.data.teams.length}`);
  const byType = new Map<string, number>();
  for (const t of teamsResult.data.teams) {
    const k = t.teamType ?? "(none)";
    byType.set(k, (byType.get(k) ?? 0) + 1);
  }
  for (const [type, count] of [...byType].sort((a, b) => b[1] - a[1])) {
    console.log(`    teamType=${type}: ${count}`);
  }

  const vflNames = [
    "Casey",
    "Box Hill",
    "Footscray",
    "Williamstown",
    "Werribee",
    "Coburg",
    "Northern",
    "Sandringham",
    "Frankston",
    "Port Melbourne",
    "Carlton VFL",
    "Brisbane Reserves",
    "Reserves",
    "Aspley",
  ];
  console.log("\n  Possible VFL/reserves team matches:");
  let any = false;
  for (const team of teamsResult.data.teams) {
    if (vflNames.some((needle) => team.name.includes(needle))) {
      any = true;
      console.log(`    id=${team.id}  name=${team.name}  teamType=${team.teamType ?? "(none)"}`);
    }
  }
  if (!any) console.log("    (no matches by known VFL team names)");
}

console.log("\n=== Probe complete ===");
