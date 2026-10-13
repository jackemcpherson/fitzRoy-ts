/**
 * Source-adapter bootstrap and public surface.
 *
 * `SourceRegistryLive` yields each per-source adapter (an Effect that reads
 * its client service) and builds the per-capability registries. Public API
 * functions (`src/api/*`) read the registries from the `SourceRegistry`
 * service, so there is no import-time registration to tree-shake away.
 */

import { Effect, Layer } from "effect";
import {
  aflApiLadderSource,
  aflApiLineupSource,
  aflApiMatchSource,
  aflApiPlayerStatsSource,
  aflApiSquadSource,
} from "./afl-api";
import {
  aflTablesLadderSource,
  aflTablesMatchCoachesSource,
  aflTablesMatchSource,
  aflTablesPlayerStatsSource,
  aflTablesSquadSource,
  aflTablesTeamStatsSource,
} from "./afl-tables";
import {
  footyWireMatchCoachesSource,
  footyWireMatchSource,
  footyWirePlayerStatsSource,
  footyWireSquadSource,
  footyWireTeamStatsSource,
} from "./footywire";
import { fryziggPlayerStatsSource } from "./fryzigg";
import { CapabilityRegistry, SourceRegistry } from "./registry";
import { squiggleLadderSource, squiggleMatchSource } from "./squiggle";

/**
 * Build every capability registry from the source services.
 *
 * Registration order is significant: it is the order of the "Supported
 * sources" list in errors and of the alternative-source search (ADR-0001).
 */
export const SourceRegistryLive = Layer.effect(
  SourceRegistry,
  Effect.gen(function* () {
    return {
      match: new CapabilityRegistry("afl-api", [
        yield* aflApiMatchSource,
        yield* footyWireMatchSource,
        yield* aflTablesMatchSource,
        yield* squiggleMatchSource,
      ]),
      matchCoaches: new CapabilityRegistry("afl-tables", [
        yield* aflTablesMatchCoachesSource,
        yield* footyWireMatchCoachesSource,
      ]),
      playerStats: new CapabilityRegistry("afl-api", [
        yield* aflApiPlayerStatsSource,
        yield* footyWirePlayerStatsSource,
        yield* aflTablesPlayerStatsSource,
        yield* fryziggPlayerStatsSource,
      ]),
      // No AFL API endpoint — afl-tables is the senior fallback.
      teamStats: new CapabilityRegistry("afl-tables", [
        yield* footyWireTeamStatsSource,
        yield* aflTablesTeamStatsSource,
      ]),
      // AFL API (all comps), FootyWire and AFL Tables (AFLM only).
      squad: new CapabilityRegistry("afl-api", [
        yield* aflApiSquadSource,
        yield* footyWireSquadSource,
        yield* aflTablesSquadSource,
      ]),
      lineup: new CapabilityRegistry("afl-api", [yield* aflApiLineupSource]),
      ladder: new CapabilityRegistry("afl-api", [
        yield* aflApiLadderSource,
        yield* aflTablesLadderSource,
        yield* squiggleLadderSource,
      ]),
    };
  }),
);

export type {
  CapabilityAdapter,
  LadderSource,
  LineupSource,
  MatchCoachesSource,
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

export { CapabilityRegistry, SourceRegistry } from "./registry";
