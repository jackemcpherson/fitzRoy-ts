/**
 * fitzRoy-ts — TypeScript library for AFL data access.
 *
 * @packageDocumentation
 */

export {
  parseAflApiDate,
  parseAflTablesDate,
  parseFootyWireDate,
  toAestString,
} from "./lib/date-utils";
export { AflApiError, ScrapeError, ValidationError } from "./lib/errors";
export { type Err, err, type Ok, ok, type Result } from "./lib/result";
export { normaliseTeamName } from "./lib/team-mapping";
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
