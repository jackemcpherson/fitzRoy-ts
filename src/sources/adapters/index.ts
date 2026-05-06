/**
 * Source-adapter bootstrap and public surface.
 *
 * This module:
 *   1. Imports each per-source adapter class
 *   2. Instantiates a default adapter for each (source × capability) cell
 *   3. Registers them in the per-capability registries
 *   4. Re-exports the registries and supporting types
 *
 * Public API functions (`src/api/*`) import the registries from this
 * module, which guarantees that adapter registration has run before any
 * lookup. The bundler can't tree-shake the registrations away because
 * this module *is* what gets imported.
 */

import {
  AflApiLadderSource,
  AflApiLineupSource,
  AflApiMatchSource,
  AflApiPlayerStatsSource,
  AflApiSquadSource,
} from "./afl-api";
import {
  AflTablesLadderSource,
  AflTablesMatchSource,
  AflTablesPlayerStatsSource,
  AflTablesSquadSource,
  AflTablesTeamStatsSource,
} from "./afl-tables";
import {
  FootyWireMatchSource,
  FootyWirePlayerStatsSource,
  FootyWireSquadSource,
  FootyWireTeamStatsSource,
} from "./footywire";
import { FryziggPlayerStatsSource } from "./fryzigg";
import {
  ladderRegistry,
  lineupRegistry,
  matchRegistry,
  playerStatsRegistry,
  squadRegistry,
  teamStatsRegistry,
} from "./registry";
import { SquiggleLadderSource, SquiggleMatchSource } from "./squiggle";

// ---------------------------------------------------------------------------
// Match
// ---------------------------------------------------------------------------
matchRegistry.register(new AflApiMatchSource());
matchRegistry.register(new FootyWireMatchSource());
matchRegistry.register(new AflTablesMatchSource());
matchRegistry.register(new SquiggleMatchSource());

// ---------------------------------------------------------------------------
// PlayerStats
// ---------------------------------------------------------------------------
playerStatsRegistry.register(new AflApiPlayerStatsSource());
playerStatsRegistry.register(new FootyWirePlayerStatsSource());
playerStatsRegistry.register(new AflTablesPlayerStatsSource());
playerStatsRegistry.register(new FryziggPlayerStatsSource());

// ---------------------------------------------------------------------------
// TeamStats (no AFL API endpoint — afl-tables is the senior fallback)
// ---------------------------------------------------------------------------
teamStatsRegistry.register(new FootyWireTeamStatsSource());
teamStatsRegistry.register(new AflTablesTeamStatsSource());

// ---------------------------------------------------------------------------
// Squad — AFL API (all comps), FootyWire and AFL Tables (AFLM only).
// ---------------------------------------------------------------------------
squadRegistry.register(new AflApiSquadSource());
squadRegistry.register(new FootyWireSquadSource());
squadRegistry.register(new AflTablesSquadSource());

// ---------------------------------------------------------------------------
// Lineup (AFL API only)
// ---------------------------------------------------------------------------
lineupRegistry.register(new AflApiLineupSource());

// ---------------------------------------------------------------------------
// Ladder
// ---------------------------------------------------------------------------
ladderRegistry.register(new AflApiLadderSource());
ladderRegistry.register(new AflTablesLadderSource());
ladderRegistry.register(new SquiggleLadderSource());

// ---------------------------------------------------------------------------
// Re-exports — public surface for src/api/*
// ---------------------------------------------------------------------------
export type {
  CapabilityAdapter,
  LadderSource,
  LineupSource,
  MatchSource,
  PlayerStatsSource,
  SquadSource,
  TeamStatsSource,
} from "./capabilities";
export {
  type CoverageMap,
  type CoverageRequest,
  checkCoverage,
  findAlternativeSource,
  type SeasonRange,
  unsupportedSourceForOperation,
} from "./coverage";
export { type DispatchQuery, dispatch } from "./dispatch";
export {
  CapabilityRegistry,
  ladderRegistry,
  lineupRegistry,
  matchRegistry,
  playerStatsRegistry,
  squadRegistry,
  teamStatsRegistry,
} from "./registry";
