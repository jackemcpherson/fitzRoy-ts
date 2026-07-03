/**
 * Raw upstream response schemas — the `fitzroy/schemas` subpath export.
 *
 * These Zod schemas mirror the AFL API and Squiggle wire formats
 * verbatim, so they change whenever the upstreams do. They moved out of
 * the package root in v3 so that upstream drift no longer forces a
 * major release of the core API; depend on this subpath only if you
 * are deliberately coupling to the raw wire shapes.
 *
 * **Support level:** wire shapes only — schemas in this subpath may
 * change at **minor** versions when an upstream API response shape
 * changes. They are not subject to the same semver stability guarantee
 * as the types and functions exported from the package root (`fitzroy`).
 *
 * @example
 * ```typescript
 * import { MatchItemListSchema } from "fitzroy/schemas";
 *
 * const result = MatchItemListSchema.safeParse(rawJson);
 * if (!result.success) {
 *   console.error("Upstream shape changed:", result.error.issues);
 * }
 * ```
 *
 * @packageDocumentation
 */

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
