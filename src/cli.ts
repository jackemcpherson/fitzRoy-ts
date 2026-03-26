#!/usr/bin/env node
import { defineCommand, runMain } from "citty";
import pc from "picocolors";
import { fixtureCommand } from "./cli/commands/fixture";
import { ladderCommand } from "./cli/commands/ladder";
import { lineupCommand } from "./cli/commands/lineup";
import { matchesCommand } from "./cli/commands/matches";
import { squadCommand } from "./cli/commands/squad";
import { statsCommand } from "./cli/commands/stats";
import { teamsCommand } from "./cli/commands/teams";
import { AflApiError, ScrapeError, UnsupportedSourceError, ValidationError } from "./lib/errors";

const main = defineCommand({
  meta: {
    name: "fitzroy",
    version: "0.1.2",
    description:
      "CLI for fetching AFL data — match results, player stats, fixtures, ladders, and more",
  },
  subCommands: {
    matches: matchesCommand,
    stats: statsCommand,
    fixture: fixtureCommand,
    ladder: ladderCommand,
    lineup: lineupCommand,
    squad: squadCommand,
    teams: teamsCommand,
  },
});

function formatError(error: unknown): string {
  if (error instanceof ValidationError && error.issues) {
    const issueLines = error.issues.map((i) => `  ${pc.yellow(i.path)}: ${i.message}`);
    return `${pc.red("Validation error:")}\n${issueLines.join("\n")}`;
  }
  if (error instanceof AflApiError) {
    const status = error.statusCode ? ` (HTTP ${error.statusCode})` : "";
    return `${pc.red("AFL API error:")} ${error.message}${status}`;
  }
  if (error instanceof ScrapeError) {
    const source = error.source ? ` [${error.source}]` : "";
    return `${pc.red("Scrape error:")} ${error.message}${source}`;
  }
  if (error instanceof UnsupportedSourceError) {
    return `${pc.red("Unsupported source:")} ${error.message}`;
  }
  if (error instanceof Error) {
    return `${pc.red("Error:")} ${error.message}`;
  }
  return `${pc.red("Error:")} ${String(error)}`;
}

runMain(main).catch((error: unknown) => {
  console.error(formatError(error));
  process.exit(1);
});
