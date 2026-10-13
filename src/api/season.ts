/**
 * Public API for resolving the default season when a caller omits `--season`.
 *
 * The authoritative resolution is data-driven: it asks the AFL API which
 * season is current (in-progress) or, failing that, most recently completed —
 * derived from the round schedule, not the local calendar year (see
 * {@link AflApiClient.resolveCurrentSeason}). If chronology is unavailable,
 * callers must choose an explicit season.
 */

import { Effect } from "effect";
import type { SourceError } from "../lib/errors";
import { AflApi } from "../sources/afl-api";
import type { CompetitionCode, CompetitionSeason, SeasonSelector } from "../types";

/**
 * Resolve the default season for a competition from the AFL's round schedule,
 * preserving the canonical selector and failing when chronology is unavailable.
 *
 * @param competition - The competition code (defaults to "AFLM").
 * @returns The season selector established by provider chronology, failing
 *   with the provider error when the season cannot be established.
 *
 * @example
 * ```ts
 * const season = yield* resolveDefaultSeasonForCompetition("AFLW");
 * ```
 */
export function resolveDefaultSeasonForCompetition(
  competition: CompetitionCode = "AFLM",
): Effect.Effect<SeasonSelector, SourceError, AflApi> {
  return AflApi.use((aflApi) => aflApi.resolveCurrentSeason(competition));
}

/**
 * Discover canonical competition seasons and their provider mappings.
 * @param competition - Competition whose provider season list should be read.
 * @returns Season keys, calendar years, display names and provider season IDs,
 * failing when discovery or identity validation fails.
 * @example
 * ```ts
 * const seasons = yield* fetchSeasons("AFLW");
 * ```
 */
export function fetchSeasons(
  competition: CompetitionCode,
): Effect.Effect<CompetitionSeason[], SourceError, AflApi> {
  return AflApi.use((aflApi) => aflApi.fetchSeasons(competition));
}
