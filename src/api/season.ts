/**
 * Public API for resolving the default season when a caller omits `--season`.
 *
 * The authoritative resolution is data-driven: it asks the AFL API which
 * season is current (in-progress) or, failing that, most recently completed —
 * derived from the round schedule, not the local calendar year (see
 * {@link AflApiClient.resolveCurrentSeason}). If chronology is unavailable,
 * callers must choose an explicit season.
 */

import { aflApiClient } from "../sources/adapters/index";
import type { CompetitionCode, CompetitionSeason, SeasonSelector } from "../types";

/**
 * Resolve the default season for a competition from the AFL's round schedule,
 * preserving the canonical selector and failing when chronology is unavailable.
 *
 * @param competition - The competition code (defaults to "AFLM").
 * @returns The season selector established by provider chronology.
 * @throws The provider error if the season cannot be established.
 *
 * @example
 * ```ts
 * const season = await resolveDefaultSeasonForCompetition("AFLW");
 * ```
 */
export async function resolveDefaultSeasonForCompetition(
  competition: CompetitionCode = "AFLM",
): Promise<SeasonSelector> {
  const result = await aflApiClient.resolveCurrentSeason(competition);
  if (result.success) {
    return result.data;
  }
  throw result.error;
}

/**
 * Discover canonical competition seasons and their provider mappings.
 * @param competition - Competition whose provider season list should be read.
 * @returns Season keys, calendar years, display names and provider season IDs,
 * or an error Result when discovery or identity validation fails.
 * @example
 * ```ts
 * const seasons = await fetchSeasons("AFLW");
 * ```
 */
export async function fetchSeasons(
  competition: CompetitionCode,
): Promise<import("../lib/result").Result<CompetitionSeason[], Error>> {
  return aflApiClient.fetchSeasons(competition);
}
