#!/usr/bin/env node
import { defineCommand, runMain } from "citty";
import pc from "picocolors";
import { AflApiError, ScrapeError, UnsupportedSourceError, ValidationError } from "./lib/errors";

declare const PACKAGE_VERSION: string;

const main = defineCommand({
  meta: {
    name: "fitzroy",
    version: PACKAGE_VERSION,
    description:
      "CLI for fetching AFL data — match results, player stats, fixtures, ladders, and more",
  },
  subCommands: {
    matches: () => import("./cli/commands/matches").then((m) => m.matchesCommand),
    stats: () => import("./cli/commands/stats").then((m) => m.statsCommand),
    fixture: () => import("./cli/commands/fixture").then((m) => m.fixtureCommand),
    ladder: () => import("./cli/commands/ladder").then((m) => m.ladderCommand),
    lineup: () => import("./cli/commands/lineup").then((m) => m.lineupCommand),
    squad: () => import("./cli/commands/squad").then((m) => m.squadCommand),
    teams: () => import("./cli/commands/teams").then((m) => m.teamsCommand),
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
