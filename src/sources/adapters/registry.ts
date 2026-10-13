/**
 * Per-capability source-adapter registries.
 *
 * Each `CapabilityRegistry<I>` is one (DataSource → adapter) map for a
 * single capability, plus the default source the CLI uses when
 * `--source` is omitted (and that the public API names in suggestion
 * messages, per ADR-0001).
 *
 * `SourceRegistryLive` in `src/sources/adapters/index.ts` builds every
 * registry from the source services; the public API never registers
 * anything itself.
 */

import { Context } from "effect";
import type { DataSource } from "../../types";
import type {
  CapabilityAdapter,
  LadderSource,
  LineupSource,
  MatchCoachesSource,
  MatchSource,
  PlayerStatsSource,
  SquadSource,
  TeamStatsSource,
} from "./capabilities";

/**
 * Generic per-capability registry.
 *
 * Holds the adapters for one capability, in registration order, plus the
 * default source for that capability.
 */
export class CapabilityRegistry<I extends CapabilityAdapter> {
  private readonly adapters: ReadonlyMap<DataSource, I>;

  constructor(
    readonly defaultSource: DataSource,
    adapters: readonly I[],
  ) {
    this.adapters = new Map(adapters.map((adapter) => [adapter.id, adapter]));
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
 * Every capability registry. Defaults follow CONTEXT.md "Source coverage" —
 * AFL API is the senior source for everything except team stats (no AFL API
 * endpoint; afl-tables is the senior fallback) and match coaches.
 */
export class SourceRegistry extends Context.Service<
  SourceRegistry,
  {
    readonly match: CapabilityRegistry<MatchSource>;
    readonly matchCoaches: CapabilityRegistry<MatchCoachesSource>;
    readonly playerStats: CapabilityRegistry<PlayerStatsSource>;
    readonly teamStats: CapabilityRegistry<TeamStatsSource>;
    readonly squad: CapabilityRegistry<SquadSource>;
    readonly lineup: CapabilityRegistry<LineupSource>;
    readonly ladder: CapabilityRegistry<LadderSource>;
  }
>()("fitzroy/SourceRegistry") {}
