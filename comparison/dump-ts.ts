import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  fetchFixture,
  fetchLadder,
  fetchLineup,
  fetchMatchResults,
  fetchPlayerStats,
  fetchSquad,
  fetchTeams,
} from "../src/index";

const outdir = join(import.meta.dirname ?? ".", "ts");
mkdirSync(outdir, { recursive: true });

function dump(file: string, data: unknown): void {
  writeFileSync(join(outdir, file), `${JSON.stringify(data, null, 2)}\n`);
}

type TestCase = {
  id: string;
  file: string;
  fn: () => Promise<{ success: boolean; data?: unknown; error?: unknown }>;
};

const cases: TestCase[] = [
  // A1: Match results, AFL API, 2024, Round 1
  {
    id: "A1",
    file: "match-results-afl-r1.json",
    fn: () => fetchMatchResults({ source: "afl-api", season: 2024, round: 1, competition: "AFLM" }),
  },
  // A2: Match results, AFL API, 2024, full season
  {
    id: "A2",
    file: "match-results-afl-full.json",
    fn: () => fetchMatchResults({ source: "afl-api", season: 2024, competition: "AFLM" }),
  },
  // A3: Match results, AFL Tables, 2024
  {
    id: "A3",
    file: "match-results-afltables.json",
    fn: () => fetchMatchResults({ source: "afl-tables", season: 2024 }),
  },
  // A4: Match results, FootyWire, 2024
  {
    id: "A4",
    file: "match-results-footywire.json",
    fn: () => fetchMatchResults({ source: "footywire", season: 2024 }),
  },
  // A5: Match results, AFL API, 2024, Finals
  {
    id: "A5",
    file: "match-results-afl-finals.json",
    fn: () =>
      fetchMatchResults({ source: "afl-api", season: 2024, round: 25, competition: "AFLM" }),
  },
  // A6: Match results, AFL Tables, 2000 (historical)
  {
    id: "A6",
    file: "match-results-afltables-2000.json",
    fn: () => fetchMatchResults({ source: "afl-tables", season: 2000 }),
  },
  // B1: Player stats, AFL API, 2024, Round 1
  {
    id: "B1",
    file: "player-stats-afl-r1.json",
    fn: () => fetchPlayerStats({ source: "afl-api", season: 2024, round: 1, competition: "AFLM" }),
  },
  // B2: Player stats, AFL API, 2024, Finals
  {
    id: "B2",
    file: "player-stats-afl-finals.json",
    fn: () => fetchPlayerStats({ source: "afl-api", season: 2024, round: 25, competition: "AFLM" }),
  },
  // C1: Fixture, AFL API, 2024, Round 1
  {
    id: "C1",
    file: "fixture-afl-r1.json",
    fn: () => fetchFixture({ source: "afl-api", season: 2024, round: 1, competition: "AFLM" }),
  },
  // C2: Fixture, AFL API, 2024, full season
  {
    id: "C2",
    file: "fixture-afl-full.json",
    fn: () => fetchFixture({ source: "afl-api", season: 2024, competition: "AFLM" }),
  },
  // D1: Lineup, AFL API, 2024, Round 1
  {
    id: "D1",
    file: "lineup-afl-r1.json",
    fn: () => fetchLineup({ source: "afl-api", season: 2024, round: 1, competition: "AFLM" }),
  },
  // E1: Ladder (expected to fail - unimplemented)
  {
    id: "E1",
    file: "ladder-afl-r10.json",
    fn: () => fetchLadder({ source: "afl-api", season: 2024, round: 10, competition: "AFLM" }),
  },
  // G1: Teams (TS-only, needed for F1)
  {
    id: "G1",
    file: "teams-aflm.json",
    fn: () => fetchTeams({ competition: "AFLM" }),
  },
];

async function main(): Promise<void> {
  // Run all cases sequentially to avoid rate limiting
  for (const tc of cases) {
    process.stdout.write(`[${tc.id}] Running... `);
    try {
      const result = await tc.fn();
      if (result.success) {
        const data = result.data;
        const count = Array.isArray(data) ? data.length : 1;
        dump(tc.file, data);
        console.log(`OK (${count} items)`);
      } else {
        dump(tc.file, { error: String(result.error) });
        console.log(`FAIL: ${result.error}`);
      }
    } catch (e) {
      dump(tc.file, { error: String(e) });
      console.log(`ERROR: ${e}`);
    }
  }

  // F1: Squad - need Carlton's teamId from G1
  process.stdout.write("[F1] Running fetchSquad for Carlton... ");
  try {
    const teamsResult = await fetchTeams({ competition: "AFLM" });
    if (teamsResult.success) {
      const carlton = teamsResult.data.find((t) => t.name.toLowerCase().includes("carlton"));
      if (carlton) {
        const squadResult = await fetchSquad({
          teamId: carlton.teamId,
          season: 2024,
          competition: "AFLM",
        });
        if (squadResult.success) {
          dump("squad-carlton.json", squadResult.data);
          console.log(`OK (${squadResult.data.players.length} players)`);
        } else {
          dump("squad-carlton.json", { error: String(squadResult.error) });
          console.log(`FAIL: ${squadResult.error}`);
        }
      } else {
        dump("squad-carlton.json", { error: "Carlton not found in teams list" });
        console.log("FAIL: Carlton not found");
      }
    } else {
      dump("squad-carlton.json", { error: String(teamsResult.error) });
      console.log(`FAIL: ${teamsResult.error}`);
    }
  } catch (e) {
    dump("squad-carlton.json", { error: String(e) });
    console.log(`ERROR: ${e}`);
  }

  console.log("\nDone! All outputs in comparison/ts/");
}

main();
