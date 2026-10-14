/**
 * Effect schemas for the AFL API /cfs/ player-level surface.
 *
 * Covers the player stats and full match roster endpoints behind
 * `api.afl.com.au/cfs/`, plus the shared inner player identity.
 * The match-level wrapper schemas live in `./afl-api-cfs`.
 *
 * Schemas use `open()` to tolerate extra fields the API may add
 * without breaking validation.
 */

import { Effect, Schema } from "effect";
import { CfsMatchSchema } from "./afl-api-cfs";
import { open, statNum } from "./shared";

// ---------------------------------------------------------------------------
// Shared inner player identity
// ---------------------------------------------------------------------------

/** Schema for the inner player identity within player stats and roster. */
const CfsPlayerInnerSchema = open({
  playerId: Schema.String,
  playerName: open({
    givenName: Schema.String,
    surname: Schema.String,
  }),
  captain: Schema.optional(Schema.Boolean),
  playerJumperNumber: Schema.optional(Schema.NullOr(Schema.Number)),
});

// ---------------------------------------------------------------------------
// Player stats (/cfs/afl/playerStats/match/{matchProviderId})
// ---------------------------------------------------------------------------

/** Schema for stat values (clearances is nested). */
export const PlayerGameStatsSchema = open({
  goals: statNum,
  behinds: statNum,
  kicks: statNum,
  handballs: statNum,
  disposals: statNum,
  marks: statNum,
  bounces: statNum,
  tackles: statNum,
  contestedPossessions: statNum,
  uncontestedPossessions: statNum,
  totalPossessions: statNum,
  inside50s: statNum,
  marksInside50: statNum,
  contestedMarks: statNum,
  hitouts: statNum,
  onePercenters: statNum,
  disposalEfficiency: statNum,
  clangers: statNum,
  freesFor: statNum,
  freesAgainst: statNum,
  dreamTeamPoints: statNum,
  clearances: Schema.optional(
    Schema.NullOr(
      open({
        centreClearances: statNum,
        stoppageClearances: statNum,
        totalClearances: statNum,
      }),
    ),
  ),
  rebound50s: statNum,
  goalAssists: statNum,
  goalAccuracy: statNum,
  turnovers: statNum,
  intercepts: statNum,
  tacklesInside50: statNum,
  shotsAtGoal: statNum,
  metresGained: statNum,
  scoreInvolvements: statNum,
  ratingPoints: statNum,
  goalEfficiency: statNum,
  shotEfficiency: statNum,
  interchangeCounts: statNum,
  brownlowVotes: statNum,
  extendedStats: Schema.optional(
    Schema.NullOr(
      open({
        effectiveDisposals: statNum,
        effectiveKicks: statNum,
        kickEfficiency: statNum,
        kickToHandballRatio: statNum,
        pressureActs: statNum,
        defHalfPressureActs: statNum,
        spoils: statNum,
        hitoutsToAdvantage: statNum,
        hitoutWinPercentage: statNum,
        hitoutToAdvantageRate: statNum,
        groundBallGets: statNum,
        f50GroundBallGets: statNum,
        interceptMarks: statNum,
        marksOnLead: statNum,
        contestedPossessionRate: statNum,
        contestOffOneOnOnes: statNum,
        contestOffWins: statNum,
        contestOffWinsPercentage: statNum,
        contestDefOneOnOnes: statNum,
        contestDefLosses: statNum,
        contestDefLossPercentage: statNum,
        centreBounceAttendances: statNum,
        kickins: statNum,
        kickinsPlayon: statNum,
        ruckContests: statNum,
        scoreLaunches: statNum,
      }),
    ),
  ),
});

/** Schema for a single player's statistics in a match. */
export const PlayerStatsItemSchema = open({
  player: open({
    player: open({
      position: Schema.optional(Schema.String),
      player: CfsPlayerInnerSchema,
    }),
    jumperNumber: Schema.optional(Schema.NullOr(Schema.Number)),
  }),
  teamId: Schema.String,
  playerStats: Schema.optional(
    Schema.NullOr(
      open({
        stats: PlayerGameStatsSchema,
        timeOnGroundPercentage: statNum,
      }),
    ),
  ),
});

/** A team's player stats: missing becomes `[]`, and an explicit `null` stays `null`. */
const PlayerStatsArray = Schema.NullOr(Schema.Array(PlayerStatsItemSchema)).pipe(
  Schema.optional,
  Schema.withDecodingDefault(Effect.succeed([])),
);

/** Schema for the player stats response. */
export const PlayerStatsListSchema = open({
  homeTeamPlayerStats: PlayerStatsArray,
  awayTeamPlayerStats: PlayerStatsArray,
});

/** Inferred type for a single player stats item. */
export type PlayerStatsItem = typeof PlayerStatsItemSchema.Type;

/** Inferred type for player game stats. */
export type PlayerGameStats = typeof PlayerGameStatsSchema.Type;

/** Inferred type for the player stats list response. */
export type PlayerStatsList = typeof PlayerStatsListSchema.Type;

// ---------------------------------------------------------------------------
// Match roster (/cfs/afl/matchRoster/full/{matchProviderId})
// ---------------------------------------------------------------------------

/** Schema for a player entry within a match roster. */
export const RosterPlayerSchema = open({
  player: open({
    position: Schema.optional(Schema.String),
    player: CfsPlayerInnerSchema,
  }),
  jumperNumber: Schema.optional(Schema.NullOr(Schema.Number)),
});

/** Schema for a team's player list in the roster. */
export const TeamPlayersSchema = open({
  teamId: Schema.String,
  players: Schema.Array(RosterPlayerSchema),
});

/** Schema for the full match roster response. */
export const MatchRosterSchema = open({
  match: CfsMatchSchema,
  teamPlayers: Schema.Array(TeamPlayersSchema),
});

/** Inferred type for a roster player. */
export type RosterPlayer = typeof RosterPlayerSchema.Type;

/** Inferred type for a team's player list. */
export type TeamPlayers = typeof TeamPlayersSchema.Type;

/** Inferred type for the match roster response. */
export type MatchRoster = typeof MatchRosterSchema.Type;
