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

import { AflApiMatchSource, AflApiPlayerStatsSource } from "./afl-api";
import { AflTablesMatchSource, AflTablesPlayerStatsSource } from "./afl-tables";
import { FootyWireMatchSource, FootyWirePlayerStatsSource } from "./footywire";
import { FryziggPlayerStatsSource } from "./fryzigg";
import { registerMatchSource, registerPlayerStatsSource } from "./registry";
import { SquiggleMatchSource } from "./squiggle";

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
  type SeasonRange,
  unsupportedSourceForOperation,
} from "./coverage";
export {
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
