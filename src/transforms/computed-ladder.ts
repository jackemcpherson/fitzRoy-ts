/**
 * Compute ladder standings from match results.
 *
 * Pure function — accumulate W/L/D/points from MatchResult[],
 * sort by premiership points then percentage.
 */

import type { LadderEntry, MatchResult } from "../types";

interface TeamAccumulator {
  played: number;
  wins: number;
  losses: number;
  draws: number;
  pointsFor: number;
  pointsAgainst: number;
}

/**
 * Compute ladder standings from a list of match results.
 *
 * @param results - Match results to compute from.
 * @param upToRound - Optional round cutoff (inclusive). If provided, only
 *   home-and-away results up to this round are included.
 * @returns Sorted ladder entries.
 */
export function computeLadder(results: readonly MatchResult[], upToRound?: number): LadderEntry[] {
  const teams = new Map<string, TeamAccumulator>();

  const filtered =
    upToRound != null
      ? results.filter((r) => r.roundType === "HomeAndAway" && r.roundNumber <= upToRound)
      : results.filter((r) => r.roundType === "HomeAndAway");

  for (const match of filtered) {
    if (match.status !== "Complete") continue;

    const home = getOrCreate(teams, match.homeTeam);
    const away = getOrCreate(teams, match.awayTeam);

    home.played++;
    away.played++;
    home.pointsFor += match.homePoints;
    home.pointsAgainst += match.awayPoints;
    away.pointsFor += match.awayPoints;
    away.pointsAgainst += match.homePoints;

    if (match.homePoints > match.awayPoints) {
      home.wins++;
      away.losses++;
    } else if (match.awayPoints > match.homePoints) {
      away.wins++;
      home.losses++;
    } else {
      home.draws++;
      away.draws++;
    }
  }

  const entries: LadderEntry[] = [...teams.entries()].map(([teamName, acc]) => {
    const percentage = acc.pointsAgainst === 0 ? 0 : (acc.pointsFor / acc.pointsAgainst) * 100;
    const premiershipsPoints = acc.wins * 4 + acc.draws * 2;

    return {
      position: 0, // filled below after sorting
      team: teamName,
      played: acc.played,
      wins: acc.wins,
      losses: acc.losses,
      draws: acc.draws,
      pointsFor: acc.pointsFor,
      pointsAgainst: acc.pointsAgainst,
      percentage,
      premiershipsPoints,
      form: null,
    };
  });

  // Sort: premiership points descending, then percentage descending
  entries.sort((a, b) => {
    if (b.premiershipsPoints !== a.premiershipsPoints) {
      return b.premiershipsPoints - a.premiershipsPoints;
    }
    return b.percentage - a.percentage;
  });

  // Assign positions
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (entry) {
      entries[i] = { ...entry, position: i + 1 };
    }
  }

  return entries;
}

function getOrCreate(map: Map<string, TeamAccumulator>, team: string): TeamAccumulator {
  let acc = map.get(team);
  if (!acc) {
    acc = { played: 0, wins: 0, losses: 0, draws: 0, pointsFor: 0, pointsAgainst: 0 };
    map.set(team, acc);
  }
  return acc;
}
