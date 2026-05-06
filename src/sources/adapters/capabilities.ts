/**
 * Per-capability source-adapter interfaces.
 *
 * Each interface represents one operation that a data source can provide.
 * A source declares which capabilities it satisfies by implementing the
 * matching interfaces and registering itself in the registry.
 *
 * The pattern intentionally splits per operation rather than one fat
 * `Source` interface — most sources support a *subset* of the operations,
 * and per-capability interfaces let each one declare only what it actually
 * does (and own its `coverage` for that operation specifically; AFL Tables
 * supports AFLM Match from 1897 but doesn't support PlayerStats before
 * ~1965, so per-capability coverage is required).
 */

import type { Result } from "../../lib/result";
import type {
  DataSource,
  Ladder,
  LadderQuery,
  Lineup,
  LineupQuery,
  Match,
  MatchQuery,
  PlayerStats,
  PlayerStatsQuery,
  Squad,
  SquadQuery,
  TeamStatsEntry,
  TeamStatsQuery,
} from "../../types";
import type { CoverageMap } from "./coverage";

/** Common shape of every adapter — id, coverage, plus capability methods. */
interface Adapter {
  readonly id: DataSource;
  readonly coverage: CoverageMap;
}

/** A source that can fetch matches. */
export interface MatchSource extends Adapter {
  fetchMatches(query: MatchQuery): Promise<Result<Match[], Error>>;
}

/** A source that can fetch per-player per-match performance stats. */
export interface PlayerStatsSource extends Adapter {
  fetchPlayerStats(query: PlayerStatsQuery): Promise<Result<PlayerStats[], Error>>;
}

/** A source that can fetch season-aggregated team performance. */
export interface TeamStatsSource extends Adapter {
  fetchTeamStats(query: TeamStatsQuery): Promise<Result<TeamStatsEntry[], Error>>;
}

/** A source that can fetch a team's seasonal squad. */
export interface SquadSource extends Adapter {
  fetchSquad(query: SquadQuery): Promise<Result<Squad, Error>>;
}

/** A source that can fetch match-day lineups. */
export interface LineupSource extends Adapter {
  fetchLineup(query: LineupQuery): Promise<Result<Lineup[], Error>>;
}

/** A source that can fetch the season ladder/standings. */
export interface LadderSource extends Adapter {
  fetchLadder(query: LadderQuery): Promise<Result<Ladder, Error>>;
}
