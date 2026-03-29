/**
 * fitzRoy-ts — TypeScript library for AFL data access.
 *
 * @packageDocumentation
 */

export { fetchAwards } from "./api/awards";
export { fetchCoachesVotes } from "./api/coaches-votes";
export { fetchFixture } from "./api/fixture";
export { fetchLadder } from "./api/ladder";
export { fetchLineup } from "./api/lineup";
export { fetchMatchResults } from "./api/match-results";
export { fetchPlayerDetails } from "./api/player-details";
export { fetchPlayerStats } from "./api/player-stats";
export { fetchTeamStats } from "./api/team-stats";
export { fetchSquad, fetchTeams } from "./api/teams";
export {
  parseAflApiDate,
  parseAflTablesDate,
  parseFootyWireDate,
  toAestString,
} from "./lib/date-utils";
export { AflApiError, ScrapeError, UnsupportedSourceError, ValidationError } from "./lib/errors";
export { type Err, err, type Ok, ok, type Result } from "./lib/result";
export {
  type SquiggleGame,
  SquiggleGameSchema,
  type SquiggleGamesResponse,
  SquiggleGamesResponseSchema,
  type SquiggleStanding,
  SquiggleStandingSchema,
  type SquiggleStandingsResponse,
  SquiggleStandingsResponseSchema,
} from "./lib/squiggle-validation";
export { normaliseTeamName } from "./lib/team-mapping";
export {
  type AflApiToken,
  AflApiTokenSchema,
  type CfsMatch,
  CfsMatchSchema,
  type CfsMatchTeam,
  CfsMatchTeamSchema,
  type CfsScore,
  CfsScoreSchema,
  type CfsVenue,
  CfsVenueSchema,
  type Competition,
  type CompetitionList,
  CompetitionListSchema,
  CompetitionSchema,
  type Compseason,
  type CompseasonList,
  CompseasonListSchema,
  CompseasonSchema,
  type LadderEntryRaw,
  LadderEntryRawSchema,
  type LadderResponse,
  LadderResponseSchema,
  type MatchItem,
  type MatchItemList,
  MatchItemListSchema,
  MatchItemSchema,
  type MatchRoster,
  MatchRosterSchema,
  type PeriodScore,
  PeriodScoreSchema,
  type PlayerGameStats,
  PlayerGameStatsSchema,
  type PlayerStatsItem,
  PlayerStatsItemSchema,
  type PlayerStatsList,
  PlayerStatsListSchema,
  type RosterPlayer,
  RosterPlayerSchema,
  type Round,
  type RoundList,
  RoundListSchema,
  RoundSchema,
  type Score,
  ScoreSchema,
  type SquadList,
  SquadListSchema,
  SquadPlayerInnerSchema,
  type SquadPlayerItem,
  SquadPlayerItemSchema,
  SquadSchema,
  type TeamItem,
  TeamItemSchema,
  type TeamList,
  TeamListSchema,
  type TeamPlayers,
  TeamPlayersSchema,
  type TeamScore,
  TeamScoreSchema,
} from "./lib/validation";
export { normaliseVenueName } from "./lib/venue-mapping";
export { AflApiClient, type AflApiClientOptions } from "./sources/afl-api";
export { AflCoachesClient, type AflCoachesClientOptions } from "./sources/afl-coaches";
export { AflTablesClient, type AflTablesClientOptions } from "./sources/afl-tables";
export { FootyWireClient, type FootyWireClientOptions } from "./sources/footywire";
export { fetchFryziggStats } from "./sources/fryzigg";
export { SquiggleClient, type SquiggleClientOptions } from "./sources/squiggle";
export { computeLadder } from "./transforms/computed-ladder";
export { transformLadderEntries } from "./transforms/ladder";
export { transformMatchRoster } from "./transforms/lineup";
export { inferRoundType, transformMatchItems } from "./transforms/match-results";
export { transformPlayerStats } from "./transforms/player-stats";
export {
  transformSquiggleGamesToFixture,
  transformSquiggleGamesToResults,
  transformSquiggleStandings,
} from "./transforms/squiggle";
export type {
  AllAustralianSelection,
  Award,
  AwardQuery,
  AwardType,
  BrownlowVote,
  CoachesVote,
  CoachesVoteQuery,
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
  PlayerDetails,
  PlayerDetailsQuery,
  PlayerStats,
  PlayerStatsQuery,
  QuarterScore,
  RisingStarNomination,
  RoundType,
  SeasonRoundQuery,
  Squad,
  SquadPlayer,
  SquadQuery,
  Team,
  TeamQuery,
  TeamStatsEntry,
  TeamStatsQuery,
  TeamStatsSummaryType,
} from "./types";
