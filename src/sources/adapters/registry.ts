/**
 * Per-capability source-adapter registries.
 *
 * The public API functions in `src/api/*` look up the adapter for the
 * requested source via these maps, then check coverage, then delegate.
 *
 * `register*` functions mutate the per-capability map. Adapters call them
 * at module load time; the public API never registers anything itself.
 *
 * The `defaultsByCapability` table records the per-operation default source
 * (per CONTEXT.md "Source coverage"). The CLI uses this when `--source` is
 * omitted; the public library functions use it as the source-suggestion
 * target for `OutOfRangeError` messages.
 */

import type { DataSource } from "../../types";
import type {
  LadderSource,
  LineupSource,
  MatchSource,
  PlayerStatsSource,
  SquadSource,
  TeamStatsSource,
} from "./capabilities";

const matchSources = new Map<DataSource, MatchSource>();
const playerStatsSources = new Map<DataSource, PlayerStatsSource>();
const teamStatsSources = new Map<DataSource, TeamStatsSource>();
const squadSources = new Map<DataSource, SquadSource>();
const lineupSources = new Map<DataSource, LineupSource>();
const ladderSources = new Map<DataSource, LadderSource>();

export function registerMatchSource(adapter: MatchSource): void {
  matchSources.set(adapter.id, adapter);
}
export function registerPlayerStatsSource(adapter: PlayerStatsSource): void {
  playerStatsSources.set(adapter.id, adapter);
}
export function registerTeamStatsSource(adapter: TeamStatsSource): void {
  teamStatsSources.set(adapter.id, adapter);
}
export function registerSquadSource(adapter: SquadSource): void {
  squadSources.set(adapter.id, adapter);
}
export function registerLineupSource(adapter: LineupSource): void {
  lineupSources.set(adapter.id, adapter);
}
export function registerLadderSource(adapter: LadderSource): void {
  ladderSources.set(adapter.id, adapter);
}

export function getMatchSource(id: DataSource): MatchSource | undefined {
  return matchSources.get(id);
}
export function getPlayerStatsSource(id: DataSource): PlayerStatsSource | undefined {
  return playerStatsSources.get(id);
}
export function getTeamStatsSource(id: DataSource): TeamStatsSource | undefined {
  return teamStatsSources.get(id);
}
export function getSquadSource(id: DataSource): SquadSource | undefined {
  return squadSources.get(id);
}
export function getLineupSource(id: DataSource): LineupSource | undefined {
  return lineupSources.get(id);
}
export function getLadderSource(id: DataSource): LadderSource | undefined {
  return ladderSources.get(id);
}

export function listMatchSources(): readonly DataSource[] {
  return [...matchSources.keys()];
}
export function listPlayerStatsSources(): readonly DataSource[] {
  return [...playerStatsSources.keys()];
}
export function listTeamStatsSources(): readonly DataSource[] {
  return [...teamStatsSources.keys()];
}
export function listSquadSources(): readonly DataSource[] {
  return [...squadSources.keys()];
}
export function listLineupSources(): readonly DataSource[] {
  return [...lineupSources.keys()];
}
export function listLadderSources(): readonly DataSource[] {
  return [...ladderSources.keys()];
}

/** All registered adapters for a capability — used by the smart suggestion helper. */
export function allMatchSources(): readonly MatchSource[] {
  return [...matchSources.values()];
}
export function allPlayerStatsSources(): readonly PlayerStatsSource[] {
  return [...playerStatsSources.values()];
}
export function allTeamStatsSources(): readonly TeamStatsSource[] {
  return [...teamStatsSources.values()];
}
export function allSquadSources(): readonly SquadSource[] {
  return [...squadSources.values()];
}
export function allLineupSources(): readonly LineupSource[] {
  return [...lineupSources.values()];
}
export function allLadderSources(): readonly LadderSource[] {
  return [...ladderSources.values()];
}

/**
 * Per-capability default source. Used by the CLI when `--source` is omitted
 * and as the source-suggestion target for OutOfRangeError messages.
 *
 * AFL API is the default for everything except TeamStats (no team-stats
 * endpoint exists on the AFL API; afl-tables is the senior fallback).
 */
export const defaultSourceByCapability: Readonly<{
  match: DataSource;
  playerStats: DataSource;
  teamStats: DataSource;
  squad: DataSource;
  lineup: DataSource;
  ladder: DataSource;
}> = {
  match: "afl-api",
  playerStats: "afl-api",
  teamStats: "afl-tables",
  squad: "afl-api",
  lineup: "afl-api",
  ladder: "afl-api",
};
