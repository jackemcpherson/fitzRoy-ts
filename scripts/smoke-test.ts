/**
 * Smoke test against the live AFL API.
 *
 * Run with: npx tsx scripts/smoke-test.ts
 */

import { AflApiClient } from "../src/sources/afl-api";

async function main() {
  const client = new AflApiClient();

  // 1. Authenticate
  console.log("--- Authenticating ---");
  const authResult = await client.authenticate();
  if (!authResult.success) {
    console.error("Auth failed:", authResult.error);
    process.exit(1);
  }
  console.log("Authenticated. Token starts with:", `${authResult.data.slice(0, 12)}...`);
  console.log("isAuthenticated:", client.isAuthenticated);

  // 2. Resolve AFLM competition ID
  console.log("\n--- Resolving AFLM competition ---");
  const compResult = await client.resolveCompetitionId("AFLM");
  if (!compResult.success) {
    console.error("Competition resolve failed:", compResult.error);
    process.exit(1);
  }
  console.log("AFLM competition ID:", compResult.data);

  // 3. Resolve 2025 season
  console.log("\n--- Resolving 2025 season ---");
  const seasonResult = await client.resolveSeasonId(compResult.data, 2025);
  if (!seasonResult.success) {
    console.error("Season resolve failed:", seasonResult.error);
    process.exit(1);
  }
  console.log("2025 season ID:", seasonResult.data);

  // 4. Fetch rounds
  console.log("\n--- Fetching rounds ---");
  const roundsResult = await client.resolveRounds(seasonResult.data);
  if (!roundsResult.success) {
    console.error("Rounds fetch failed:", roundsResult.error);
    process.exit(1);
  }
  console.log(`Found ${roundsResult.data.length} rounds:`);
  for (const round of roundsResult.data.slice(0, 5)) {
    console.log(`  Round ${round.roundNumber}: ${round.name} (id: ${round.id})`);
  }
  if (roundsResult.data.length > 5) {
    console.log(`  ... and ${roundsResult.data.length - 5} more`);
  }

  // 5. Resolve round 1 ID
  console.log("\n--- Resolving round 1 ---");
  const round1Result = await client.resolveRoundId(seasonResult.data, 1);
  if (!round1Result.success) {
    console.error("Round 1 resolve failed:", round1Result.error);
    process.exit(1);
  }
  console.log("Round 1 ID:", round1Result.data);

  // 6. Try AFLW too
  console.log("\n--- Resolving AFLW competition ---");
  const aflwResult = await client.resolveCompetitionId("AFLW");
  if (!aflwResult.success) {
    console.error("AFLW resolve failed:", aflwResult.error);
  } else {
    console.log("AFLW competition ID:", aflwResult.data);
  }

  console.log("\n--- All smoke tests passed! ---");
}

main().catch((e) => {
  console.error("Unexpected error:", e);
  process.exit(1);
});
