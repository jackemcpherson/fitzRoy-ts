/**
 * Zod schemas for the AFL API /cfs/ player-level surface.
 *
 * Covers the player stats and full match roster endpoints behind
 * `api.afl.com.au/cfs/`, plus the shared inner player identity.
 * The match-level wrapper schemas live in `./afl-api-cfs`.
 *
 * Schemas use `.passthrough()` to tolerate extra fields the API may add
 * without breaking validation.
 */

import { z } from "zod/v4";
import { CfsMatchSchema } from "./afl-api-cfs";
import { statNum } from "./shared";

// ---------------------------------------------------------------------------
// Shared inner player identity
// ---------------------------------------------------------------------------

/** Schema for the inner player identity within player stats and roster. */
const CfsPlayerInnerSchema = z
  .object({
    playerId: z.string(),
    playerName: z
      .object({
        givenName: z.string(),
        surname: z.string(),
      })
      .passthrough(),
    captain: z.boolean().optional(),
    playerJumperNumber: z.number().nullable().optional(),
  })
  .passthrough();

// ---------------------------------------------------------------------------
// Player stats (/cfs/afl/playerStats/match/{matchProviderId})
// ---------------------------------------------------------------------------

/** Schema for stat values (clearances is nested). */
export const PlayerGameStatsSchema = z
  .object({
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
    clearances: z
      .object({
        centreClearances: statNum,
        stoppageClearances: statNum,
        totalClearances: statNum,
      })
      .passthrough()
      .nullable()
      .optional(),
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
    extendedStats: z
      .object({
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
      })
      .passthrough()
      .nullable()
      .optional(),
  })
  .passthrough();

/** Schema for a single player's statistics in a match. */
export const PlayerStatsItemSchema = z
  .object({
    player: z
      .object({
        player: z
          .object({
            position: z.string().optional(),
            player: CfsPlayerInnerSchema,
          })
          .passthrough(),
        jumperNumber: z.number().nullable().optional(),
      })
      .passthrough(),
    teamId: z.string(),
    playerStats: z
      .object({
        stats: PlayerGameStatsSchema,
        timeOnGroundPercentage: statNum,
      })
      .passthrough()
      .nullable()
      .optional(),
  })
  .passthrough();

/** Schema for the player stats response. */
export const PlayerStatsListSchema = z
  .object({
    homeTeamPlayerStats: z.array(PlayerStatsItemSchema).nullable().default([]),
    awayTeamPlayerStats: z.array(PlayerStatsItemSchema).nullable().default([]),
  })
  .passthrough();

/** Inferred type for a single player stats item. */
export type PlayerStatsItem = z.infer<typeof PlayerStatsItemSchema>;

/** Inferred type for player game stats. */
export type PlayerGameStats = z.infer<typeof PlayerGameStatsSchema>;

/** Inferred type for the player stats list response. */
export type PlayerStatsList = z.infer<typeof PlayerStatsListSchema>;

// ---------------------------------------------------------------------------
// Match roster (/cfs/afl/matchRoster/full/{matchProviderId})
// ---------------------------------------------------------------------------

/** Schema for a player entry within a match roster. */
export const RosterPlayerSchema = z
  .object({
    player: z
      .object({
        position: z.string().optional(),
        player: CfsPlayerInnerSchema,
      })
      .passthrough(),
    jumperNumber: z.number().nullable().optional(),
  })
  .passthrough();

/** Schema for a team's player list in the roster. */
export const TeamPlayersSchema = z
  .object({
    teamId: z.string(),
    players: z.array(RosterPlayerSchema),
  })
  .passthrough();

/** Schema for the full match roster response. */
export const MatchRosterSchema = z
  .object({
    match: CfsMatchSchema,
    teamPlayers: z.array(TeamPlayersSchema),
  })
  .passthrough();

/** Inferred type for a roster player. */
export type RosterPlayer = z.infer<typeof RosterPlayerSchema>;

/** Inferred type for a team's player list. */
export type TeamPlayers = z.infer<typeof TeamPlayersSchema>;

/** Inferred type for the match roster response. */
export type MatchRoster = z.infer<typeof MatchRosterSchema>;
