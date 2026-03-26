/**
 * Pure transforms for flattening raw AFL API ladder data into typed LadderEntry objects.
 */

import { normaliseTeamName } from "../lib/team-mapping";
import type { LadderEntryRaw } from "../lib/validation";
import type { LadderEntry } from "../types";

/**
 * Transform raw AFL API ladder entries into typed LadderEntry objects.
 *
 * @param entries - Raw ladder entries from the API response.
 * @returns Array of typed ladder entries.
 */
export function transformLadderEntries(entries: readonly LadderEntryRaw[]): LadderEntry[] {
  return entries.map((entry) => {
    const record = entry.thisSeasonRecord;
    const wl = record?.winLossRecord;

    return {
      position: entry.position,
      team: normaliseTeamName(entry.team.name),
      played: entry.played ?? wl?.played ?? 0,
      wins: wl?.wins ?? 0,
      losses: wl?.losses ?? 0,
      draws: wl?.draws ?? 0,
      pointsFor: entry.pointsFor ?? 0,
      pointsAgainst: entry.pointsAgainst ?? 0,
      percentage: record?.percentage ?? 0,
      premiershipsPoints: record?.aggregatePoints ?? 0,
      form: entry.form ?? null,
    };
  });
}
