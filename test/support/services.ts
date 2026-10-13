/**
 * Test layers for the public API.
 *
 * {@link fixtureFitzroy} runs the complete library environment against
 * fixture routes. {@link stubRegistry} replaces the source registry with
 * hand-built adapters, so API-level tests can observe exactly what an
 * adapter received. Provide a stub inside `fixtureFitzroy` to shadow the
 * live service of the same tag.
 */

import { Effect, Layer } from "effect";
import { FetchHttpClient } from "effect/http";
import { FitzroyLive } from "../../src/layers";
import type { CoverageMap } from "../../src/sources/adapters/coverage";
import { CapabilityRegistry, SourceRegistry } from "../../src/sources/adapters/registry";
import { fixtureFetch, type RequestLog, type Route } from "./http";

/**
 * `FitzroyLive` with every request answered by fixture routes.
 *
 * Unmatched URLs get a 404, so no test reaches the network.
 */
export function fixtureFitzroy(routes: readonly Route[] = [], log?: RequestLog) {
  return FitzroyLive.pipe(
    Layer.provide(Layer.succeed(FetchHttpClient.Fetch, fixtureFetch(routes, log))),
  );
}

/** Every capability registry the {@link SourceRegistry} service holds. */
export type Registries = SourceRegistry["Service"];

/** A {@link SourceRegistry} holding the given registries; the rest are empty. */
export function stubRegistry(registries: Partial<Registries>) {
  return Layer.succeed(SourceRegistry, {
    match: registries.match ?? new CapabilityRegistry("afl-api", []),
    matchCoaches: registries.matchCoaches ?? new CapabilityRegistry("afl-tables", []),
    playerStats: registries.playerStats ?? new CapabilityRegistry("afl-api", []),
    teamStats: registries.teamStats ?? new CapabilityRegistry("afl-tables", []),
    squad: registries.squad ?? new CapabilityRegistry("afl-api", []),
    lineup: registries.lineup ?? new CapabilityRegistry("afl-api", []),
    ladder: registries.ladder ?? new CapabilityRegistry("afl-api", []),
  });
}

/** Coverage for a stub adapter: every competition, every season. */
export const FULL_COVERAGE: CoverageMap = new Map([
  ["AFLM", { minSeason: 1897 }],
  ["AFLW", { minSeason: 2017 }],
  ["VFL", { minSeason: 2021 }],
  ["VFLW", { minSeason: 2021 }],
]);

/** A stub method that the test does not expect to be called. */
export function unexpectedCall(name: string) {
  return () => Effect.die(new Error(`unexpected call: ${name}`));
}
