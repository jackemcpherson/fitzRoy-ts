/**
 * Per-capability source-adapter registries.
 *
 * Each `CapabilityRegistry<I>` is one (DataSource → adapter) map for a
 * single capability, plus the default source the CLI uses when
 * `--source` is omitted (and that the public API names in suggestion
 * messages, per ADR-0001).
 *
 * Adapters call `register()` at module load time from
 * `src/sources/adapters/index.ts`; the public API never registers
 * anything itself.
 */

import type { DataSource } from "../../types";
import type {
  CapabilityAdapter,
  LadderSource,
  LineupSource,
  MatchSource,
  PlayerStatsSource,
  SquadSource,
  TeamStatsSource,
} from "./capabilities";

/**
 * Generic per-capability registry.
 *
 * Holds a `Map<DataSource, I>` plus the default source for this
 * capability. Instantiated once per capability interface.
 */
export class CapabilityRegistry<I extends CapabilityAdapter> {
  private readonly adapters = new Map<DataSource, I>();

  constructor(readonly defaultSource: DataSource) {}

  register(adapter: I): void {
    this.adapters.set(adapter.id, adapter);
  }

  get(id: DataSource): I | undefined {
    return this.adapters.get(id);
  }

  list(): readonly DataSource[] {
    return [...this.adapters.keys()];
  }

  all(): readonly I[] {
    return [...this.adapters.values()];
  }
}

/**
 * One registry per capability. Defaults follow CONTEXT.md "Source coverage" —
 * AFL API is the senior source for everything except team stats (no AFL API
 * endpoint; afl-tables is the senior fallback).
 */
export const matchRegistry = new CapabilityRegistry<MatchSource>("afl-api");
export const playerStatsRegistry = new CapabilityRegistry<PlayerStatsSource>("afl-api");
export const teamStatsRegistry = new CapabilityRegistry<TeamStatsSource>("afl-tables");
export const squadRegistry = new CapabilityRegistry<SquadSource>("afl-api");
export const lineupRegistry = new CapabilityRegistry<LineupSource>("afl-api");
export const ladderRegistry = new CapabilityRegistry<LadderSource>("afl-api");
