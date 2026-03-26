#!/usr/bin/env node
import { defineCommand, runMain } from "citty";
import { fixtureCommand } from "./cli/commands/fixture";
import { ladderCommand } from "./cli/commands/ladder";
import { lineupCommand } from "./cli/commands/lineup";
import { matchesCommand } from "./cli/commands/matches";
import { squadCommand } from "./cli/commands/squad";
import { statsCommand } from "./cli/commands/stats";
import { teamsCommand } from "./cli/commands/teams";

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

runMain(main);
