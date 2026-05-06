/**
 * Source-adapter bootstrap and public surface.
 *
 * This module:
 *   1. Imports each per-source adapter class
 *   2. Instantiates a default adapter for each (source × capability) cell
 *   3. Registers them in the per-capability registries
 *   4. Re-exports the registry getters and supporting types
 *
 * Public API functions (`src/api/*`) import the registry getters from
 * this module, which guarantees that adapter registration has run before
 * any lookup. The bundler can't tree-shake the registrations away because
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
  AflTablesTeamStatsSource,
} from "./afl-tables";
import {
  FootyWireMatchSource,
  FootyWirePlayerStatsSource,
  FootyWireTeamStatsSource,
} from "./footywire";
import { FryziggPlayerStatsSource } from "./fryzigg";
import {
  registerLadderSource,
  registerLineupSource,
  registerMatchSource,
  registerPlayerStatsSource,
  registerSquadSource,
  registerTeamStatsSource,
} from "./registry";
import { SquiggleLadderSource, SquiggleMatchSource } from "./squiggle";

// ---------------------------------------------------------------------------
// Match
// ---------------------------------------------------------------------------
registerMatchSource(new AflApiMatchSource());
registerMatchSource(new FootyWireMatchSource());
registerMatchSource(new AflTablesMatchSource());
registerMatchSource(new SquiggleMatchSource());

// ---------------------------------------------------------------------------
// PlayerStats
// ---------------------------------------------------------------------------
registerPlayerStatsSource(new AflApiPlayerStatsSource());
registerPlayerStatsSource(new FootyWirePlayerStatsSource());
registerPlayerStatsSource(new AflTablesPlayerStatsSource());
registerPlayerStatsSource(new FryziggPlayerStatsSource());

// ---------------------------------------------------------------------------
// TeamStats (no AFL API endpoint — afl-tables is the senior fallback)
// ---------------------------------------------------------------------------
registerTeamStatsSource(new FootyWireTeamStatsSource());
registerTeamStatsSource(new AflTablesTeamStatsSource());

// ---------------------------------------------------------------------------
// Squad / Lineup (AFL API only)
// ---------------------------------------------------------------------------
registerSquadSource(new AflApiSquadSource());
registerLineupSource(new AflApiLineupSource());

// ---------------------------------------------------------------------------
// Ladder
// ---------------------------------------------------------------------------
registerLadderSource(new AflApiLadderSource());
registerLadderSource(new AflTablesLadderSource());
registerLadderSource(new SquiggleLadderSource());

// ---------------------------------------------------------------------------
// Re-exports — public surface for src/api/*
// ---------------------------------------------------------------------------
export type {
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
export {
  allLadderSources,
  allLineupSources,
  allMatchSources,
  allPlayerStatsSources,
  allSquadSources,
  allTeamStatsSources,
  defaultSourceByCapability,
  getLadderSource,
  getLineupSource,
  getMatchSource,
  getPlayerStatsSource,
  getSquadSource,
  getTeamStatsSource,
  listLadderSources,
  listLineupSources,
  listMatchSources,
  listPlayerStatsSources,
  listSquadSources,
  listTeamStatsSources,
} from "./registry";
