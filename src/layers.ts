/**
 * Layer composition for the library.
 *
 * {@link FitzroyLive} provides every source service, the source registry, and
 * the shared HTTP policy. Provide it once at the edge of a program:
 *
 * ```ts
 * const matches = await Effect.runPromise(
 *   fetchMatches({ source: "afl-api", season: 2025, round: 1 }).pipe(Effect.provide(FitzroyLive)),
 * );
 * ```
 *
 * One `AflApi` instance serves every AFL API adapter and direct call, so the
 * access token is requested once per runtime.
 */

import { Layer } from "effect";
import { SourceHttpLive } from "./lib/http";
import { SourceRegistryLive } from "./sources/adapters/index";
import { AflApiLive } from "./sources/afl-api";
import { AflCoachesLive } from "./sources/afl-coaches";
import { AflTablesLive } from "./sources/afl-tables";
import { FootyWireLive } from "./sources/footywire";
import { FryziggLive, RdsParserLive } from "./sources/fryzigg";
import { MatchCoachesLive } from "./sources/match-coaches";
import { SquiggleLive } from "./sources/squiggle";

/** Every source client, sharing one {@link SourceHttpLive}. */
export const SourcesLive = Layer.mergeAll(
  AflApiLive,
  AflCoachesLive,
  AflTablesLive,
  FootyWireLive,
  FryziggLive,
  MatchCoachesLive,
  SquiggleLive,
).pipe(Layer.provide(RdsParserLive), Layer.provideMerge(SourceHttpLive));

/** The complete library environment: source clients plus the source registry. */
export const FitzroyLive = SourceRegistryLive.pipe(Layer.provideMerge(SourcesLive));
