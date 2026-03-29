import {
  fetchFixture,
  fetchLadder,
  fetchLineup,
  fetchMatchResults,
  fetchPlayerStats,
  fetchSquad,
  fetchTeams,
} from "../src/index";

async function bench(
  label: string,
  fn: () => Promise<{ success: boolean; data?: unknown }>,
): Promise<void> {
  const padded = label.padEnd(45);
  const start = performance.now();
  const result = await fn();
  const elapsed = ((performance.now() - start) / 1000).toFixed(2);
  const count = result.success ? (Array.isArray(result.data) ? result.data.length : 1) : 0;
  console.log(`${padded}${elapsed.padStart(6)}s  (${count} items)`);
}

async function main(): Promise<void> {
  console.log("=== fitzRoy-ts Performance ===\n");

  await bench("fetchMatchResults(2024, Rd 1, afl-api)", () =>
    fetchMatchResults({ source: "afl-api", season: 2024, round: 1, competition: "AFLM" }),
  );

  await bench("fetchMatchResults(2024, full season, afl-api)", () =>
    fetchMatchResults({ source: "afl-api", season: 2024, competition: "AFLM" }),
  );

  await bench("fetchMatchResults(2024, afl-tables)", () =>
    fetchMatchResults({ source: "afl-tables", season: 2024 }),
  );

  await bench("fetchPlayerStats(2024, Rd 1, afl-api)", () =>
    fetchPlayerStats({ source: "afl-api", season: 2024, round: 1, competition: "AFLM" }),
  );

  await bench("fetchFixture(2024, Rd 1, afl-api)", () =>
    fetchFixture({ source: "afl-api", season: 2024, round: 1, competition: "AFLM" }),
  );

  await bench("fetchLadder(2024, Rd 10, afl-api)", () =>
    fetchLadder({ source: "afl-api", season: 2024, round: 10, competition: "AFLM" }),
  );

  await bench("fetchLineup(2024, Rd 1, afl-api)", () =>
    fetchLineup({ source: "afl-api", season: 2024, round: 1, competition: "AFLM" }),
  );

  // Need Carlton's teamId for squad
  const teams = await fetchTeams({ competition: "AFLM" });
  const carltonId = teams.success
    ? teams.data.find((t) => t.name.toLowerCase().includes("carlton"))?.teamId
    : undefined;

  if (carltonId) {
    await bench("fetchSquad(2024, Carlton, afl-api)", () =>
      fetchSquad({ teamId: carltonId, season: 2024, competition: "AFLM" }),
    );
  }

  console.log("\nDone.");
}

main();
