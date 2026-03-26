#!/usr/bin/env node
import { defineCommand, runMain } from "citty";

const main = defineCommand({
  meta: {
    name: "fitzroy",
    version: "0.1.2",
    description:
      "CLI for fetching AFL data — match results, player stats, fixtures, ladders, and more",
  },
  subCommands: {},
});

runMain(main);
