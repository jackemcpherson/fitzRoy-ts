#!/usr/bin/env node
import { defineCommand, runMain } from "citty";
import { resolveAliases } from "./cli/alias-resolution";
import { formatError } from "./cli/error-boundary";

resolveAliases();

declare const PACKAGE_VERSION: string;

const main = defineCommand({
  meta: {
    name: "fitzroy",
    version: PACKAGE_VERSION,
    description: "TypeScript port of the fitzRoy R package — fetch AFL data from the command line",
  },
  subCommands: {
    team: () => import("./cli/commands/team").then((m) => m.teamCommand),
    player: () => import("./cli/commands/player").then((m) => m.playerCommand),
    match: () => import("./cli/commands/match").then((m) => m.matchCommand),
    stats: () => import("./cli/commands/stats").then((m) => m.statsCommand),
    ladder: () => import("./cli/commands/ladder").then((m) => m.ladderCommand),
    awards: () => import("./cli/commands/awards").then((m) => m.awardsCommand),
  },
});

runMain(main).catch((error: unknown) => {
  console.error(formatError(error));
  process.exit(1);
});
