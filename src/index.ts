/**
 * fitzRoy-ts — TypeScript port of the {@link https://github.com/jimmyday12/fitzRoy | fitzRoy R package}
 * for programmatic access to AFL (Australian Football League) data.
 *
 * Version 7 is built on Effect. Every `fetch*` function returns an `Effect`
 * that fails with a tagged error and requires source services. Provide
 * {@link FitzroyLive} to run them. The entry point also exports the domain
 * schemas and types, the errors, the source services, and a handful of
 * date/name utilities. Raw upstream wire schemas live in the
 * `fitzroy/schemas` subpath; internal transforms are not exported.
 *
 * @packageDocumentation
 */

export { type AwardServices, fetchAwards } from "./api/awards";

export { fetchLadder } from "./api/ladder";

export { fetchLineup } from "./api/lineup";

export { fetchMatches } from "./api/match";

export { fetchMatchCoaches } from "./api/match-coaches";

export { fetchPlayerDetails } from "./api/player-details";

export { fetchPlayerStats } from "./api/player-stats";

export { fetchSeasons, resolveDefaultSeasonForCompetition } from "./api/season";

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
  AmbiguousSeasonError,
  DstGapError,
  IncompleteDataError,
  OutOfRangeError,
  ScrapeError,
  type SourceError,
  UnsupportedCompetitionError,
  UnsupportedSourceError,
  ValidationError,
} from "./lib/errors";

export {
  RequestError,
  SourceHttp,
  SourceHttpConfig,
  SourceHttpLive,
  type SourceHttpOptions,
  type SourceRequestInit,
} from "./lib/http";

export { roundAbbreviation, roundLabel, roundTypeLabel } from "./lib/round-labels";

export { normaliseTeamName } from "./lib/team-mapping";

export { normaliseVenueName } from "./lib/venue-mapping";

export { resolveVenueTimezone } from "./lib/venue-timezones";

export { FitzroyLive, SourcesLive } from "./layers";

export { SourceRegistry } from "./sources/adapters/index";

export { AflApi, AflApiLive } from "./sources/afl-api";

export { AflCoaches, AflCoachesLive } from "./sources/afl-coaches";

export { AflTables, AflTablesLive } from "./sources/afl-tables";

export { FootyWire, FootyWireLive } from "./sources/footywire";

export { Fryzigg, FryziggConfig, FryziggLive, RdsParser, RdsParserLive } from "./sources/fryzigg";

export { MatchCoaches, MatchCoachesLive } from "./sources/match-coaches";

export { Squiggle, SquiggleLive } from "./sources/squiggle";

export type {
  AllAustralianSelection,
  Award,
  AwardQuery,
  AwardResult,
  AwardType,
  BrownlowVote,
  CoachesVote,
  CoachesVoteQuery,
  CoachesVotesResult,
  ColemanLeader,
  CompetitionCode,
  CompetitionSeason,
  DataSource,
  Ladder,
  LadderEntry,
  LadderQuery,
  Lineup,
  LineupPlayer,
  LineupQuery,
  Match,
  MatchCoachAssignment,
  MatchCoachesQuery,
  MatchCoachesResult,
  MatchCoachFailure,
  MatchQuery,
  MatchStatus,
  Player,
  PlayerDetails,
  PlayerDetailsQuery,
  PlayerDetailsResult,
  PlayerStats,
  PlayerStatsQuery,
  QuarterScore,
  RisingStarNomination,
  RoundType,
  SeasonPlayerStats,
  SeasonRoundQuery,
  SeasonSelector,
  Squad,
  SquadQuery,
  SquadScope,
  Team,
  TeamMetricSet,
  TeamQuery,
  TeamResponse,
  TeamStatsEntry,
  TeamStatsQuery,
  TeamStatsSummaryType,
} from "./types";

export {
  AllAustralianSelectionSchema,
  AwardQuerySchema,
  AwardResultSchema,
  AwardSchema,
  AwardTypeSchema,
  BrownlowVoteSchema,
  CoachesVoteQuerySchema,
  CoachesVoteSchema,
  CoachesVotesResultSchema,
  ColemanLeaderSchema,
  CompetitionCodeSchema,
  CompetitionSeasonSchema,
  DataSourceSchema,
  LadderEntrySchema,
  LadderQuerySchema,
  LadderSchema,
  LineupPlayerSchema,
  LineupQuerySchema,
  LineupSchema,
  MatchClockPeriodSchema,
  MatchCoachAssignmentSchema,
  MatchCoachesQuerySchema,
  MatchCoachesResultSchema,
  MatchCoachFailureSchema,
  MatchQuerySchema,
  MatchSchema,
  MatchStatusSchema,
  PlayerDetailsQuerySchema,
  PlayerDetailsResultSchema,
  PlayerDetailsSchema,
  PlayerSchema,
  PlayerStatsQuerySchema,
  PlayerStatsSchema,
  QuarterScoreSchema,
  RisingStarNominationSchema,
  RoundTypeSchema,
  SeasonPlayerStatsSchema,
  SeasonRoundQuerySchema,
  SeasonSelectorSchema,
  SquadQuerySchema,
  SquadSchema,
  SquadScopeSchema,
  TeamMetricSetSchema,
  TeamQuerySchema,
  TeamResponseSchema,
  TeamSchema,
  TeamStatsEntrySchema,
  TeamStatsQuerySchema,
  TeamStatsSummaryTypeSchema,
} from "./types";
