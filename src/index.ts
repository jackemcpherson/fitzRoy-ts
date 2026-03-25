/**
 * fitzRoy-ts — TypeScript library for AFL data access.
 *
 * @packageDocumentation
 */

export { AflApiError, ScrapeError, ValidationError } from "./lib/errors";
export { type Err, err, type Ok, ok, type Result } from "./lib/result";
export type {
  CompetitionCode,
  DataSource,
  Fixture,
  Ladder,
  LadderEntry,
  LadderQuery,
  Lineup,
  LineupPlayer,
  LineupQuery,
  MatchQuery,
  MatchResult,
  MatchStatus,
  PlayerStats,
  PlayerStatsQuery,
  QuarterScore,
  RoundType,
  SeasonRoundQuery,
  Squad,
  SquadPlayer,
  SquadQuery,
  Team,
  TeamQuery,
} from "./types";
