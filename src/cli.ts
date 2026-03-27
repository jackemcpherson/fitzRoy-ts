#!/usr/bin/env node
import { defineCommand, runMain } from "citty";
import { formatError } from "./cli/error-boundary";

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
    "team-stats": () => import("./cli/commands/team-stats").then((m) => m.teamStatsCommand),
    "player-details": () =>
      import("./cli/commands/player-details").then((m) => m.playerDetailsCommand),
    "coaches-votes": () =>
      import("./cli/commands/coaches-votes").then((m) => m.coachesVotesCommand),
  },
});

runMain(main).catch((error: unknown) => {
  console.error(formatError(error));
  process.exit(1);
});
