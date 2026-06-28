/**
 * Public API for resolving the default season when a caller omits `--season`.
 *
 * The authoritative resolution is data-driven: it asks the AFL API which
 * season is current (in-progress) or, failing that, most recently completed —
 * derived from the round schedule, not the local calendar year (see
 * {@link AflApiClient.resolveCurrentSeason}). When the AFL API is unreachable
 * or cannot determine the season, this falls back to the clock-based
 * approximation in {@link resolveDefaultSeason} so the CLI still works offline.
 */

import { resolveDefaultSeason } from "../lib/date-utils";
import { aflApiClient } from "../sources/adapters/index";
import type { CompetitionCode } from "../types";

/**
 * Resolve the default season for a competition from the AFL's round schedule,
 * falling back to the calendar-based approximation when the lookup fails.
 *
 * @param competition - The competition code (defaults to "AFLM").
 * @returns The resolved season year (data-driven, else the offline fallback).
 *
 * @example
 * ```ts
 * const season = await resolveDefaultSeasonForCompetition("AFLW");
 * ```
 */
export async function resolveDefaultSeasonForCompetition(
  competition: CompetitionCode = "AFLM",
): Promise<number> {
  const result = await aflApiClient.resolveCurrentSeason(competition);
  if (result.success) {
    return result.data;
  }
  return resolveDefaultSeason(competition);
}
