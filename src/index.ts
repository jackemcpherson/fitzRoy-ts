/**
 * fitzRoy-ts — TypeScript port of the {@link https://github.com/jimmyday12/fitzRoy | fitzRoy R package}
 * for programmatic access to AFL (Australian Football League) data.
 *
 * v3 trimmed this entry point to the supported surface: the `fetch*`
 * functions, the domain model, errors, the Result type, source clients
 * (for fetch/timeout injection), and a handful of date/name utilities.
 * Raw upstream wire schemas live in the `fitzroy/schemas` subpath;
 * internal transforms are no longer exported.
 *
 * @packageDocumentation
 */

export { fetchAwards } from "./api/awards";
export { fetchLadder } from "./api/ladder";
export { fetchLineup } from "./api/lineup";
export { fetchMatches } from "./api/match";
export { fetchPlayerDetails } from "./api/player-details";
export { fetchPlayerStats } from "./api/player-stats";
export { resolveDefaultSeasonForCompetition } from "./api/season";
export { fetchTeamStats } from "./api/team-stats";
export { fetchSquad, fetchTeams } from "./api/teams";
export {
  localToUtc,
  type ParseDateOptions,
  parseDate,
  resolveDefaultSeason,
  toAestString,
} from "./lib/date-utils";
export {
  AflApiError,
  DstGapError,
  OutOfRangeError,
  ScrapeError,
  UnsupportedCompetitionError,
  UnsupportedSourceError,
  ValidationError,
} from "./lib/errors";
export type { FetchRetryOptions } from "./lib/fetch-retry";
export type { FetchTimeoutOptions } from "./lib/fetch-timeout";
export { type Err, err, type Ok, ok, Result } from "./lib/result";
export {
  roundAbbreviation,
  roundLabel,
  roundTypeLabel,
} from "./lib/round-labels";
export type { SourceFetchOptions } from "./lib/source-fetch";
export { normaliseTeamName } from "./lib/team-mapping";
export { normaliseVenueName } from "./lib/venue-mapping";
export { resolveVenueTimezone } from "./lib/venue-timezones";
export { AflApiClient, type AflApiClientOptions } from "./sources/afl-api";
export { AflCoachesClient, type AflCoachesClientOptions } from "./sources/afl-coaches";
export { AflTablesClient, type AflTablesClientOptions } from "./sources/afl-tables";
export { FootyWireClient, type FootyWireClientOptions } from "./sources/footywire";
export { FryziggClient, type FryziggClientOptions } from "./sources/fryzigg";
export { SquiggleClient, type SquiggleClientOptions } from "./sources/squiggle";
export type {
  AllAustralianSelection,
  Award,
  AwardQuery,
  AwardType,
  BrownlowVote,
  CoachesVote,
  CoachesVoteQuery,
  ColemanLeader,
  CompetitionCode,
  DataSource,
  Ladder,
  LadderEntry,
  LadderQuery,
  Lineup,
  LineupPlayer,
  LineupQuery,
  Match,
  MatchQuery,
  MatchStatus,
  Player,
  PlayerDetails,
  PlayerDetailsQuery,
  PlayerStats,
  PlayerStatsQuery,
  QuarterScore,
  RisingStarNomination,
  RoundType,
  SeasonPlayerStats,
  SeasonRoundQuery,
  Squad,
  SquadQuery,
  Team,
  TeamMetricSet,
  TeamQuery,
  TeamResponse,
  TeamStatsEntry,
  TeamStatsQuery,
  TeamStatsSummaryType,
} from "./types";
