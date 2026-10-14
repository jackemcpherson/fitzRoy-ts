#!/usr/bin/env node
import { defineCommand, runMain } from "citty";
import { Cause } from "effect";
import { resolveAliases } from "./cli/alias-resolution";
import { formatCause } from "./cli/error-boundary";

resolveAliases();

declare const PACKAGE_VERSION: string;

const main = defineCommand({
  meta: {
    name: "fitzroy",
    version: PACKAGE_VERSION,
    description: "TypeScript port of the fitzRoy R package — fetch AFL data from the command line",
  },
  subCommands: {
    seasons: () => import("./cli/commands/seasons").then((m) => m.seasonsCommand),
    team: () => import("./cli/commands/team").then((m) => m.teamCommand),
    player: () => import("./cli/commands/player").then((m) => m.playerCommand),
    match: () => import("./cli/commands/match").then((m) => m.matchCommand),
    stats: () => import("./cli/commands/stats").then((m) => m.statsCommand),
    ladder: () => import("./cli/commands/ladder").then((m) => m.ladderCommand),
    awards: () => import("./cli/commands/awards").then((m) => m.awardsCommand),
  },
});

// Command failures are handled by each command's `runCommand` boundary; this
// catches anything Citty itself lets escape.
runMain(main).catch((cause: unknown) => {
  console.error(formatCause(Cause.die(cause)));
  process.exit(1);
});
