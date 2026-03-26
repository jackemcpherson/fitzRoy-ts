/**
 * Zod schemas for validating AFL API response shapes at the boundary.
 *
 * Each schema validates the raw JSON structure returned by the AFL API.
 * Inferred TypeScript types are exported alongside their schemas so
 * consumers can reference the raw API shapes before transformation.
 *
 * Schemas use `.passthrough()` to tolerate extra fields the API may add
 * without breaking validation.
 */

import { z } from "zod/v4";

// ---------------------------------------------------------------------------
// Token response (WMCTok endpoint)
// ---------------------------------------------------------------------------

/** Schema for the AFL API WMCTok token response. */
export const AflApiTokenSchema = z
  .object({
    token: z.string(),
    disclaimer: z.string().optional(),
  })
  .passthrough();

/** Inferred type for the AFL API token response. */
export type AflApiToken = z.infer<typeof AflApiTokenSchema>;

// ---------------------------------------------------------------------------
// Competition list (/afl/v2/competitions)
// ---------------------------------------------------------------------------

/** Schema for a single competition entry. */
export const CompetitionSchema = z
  .object({
    id: z.number(),
    name: z.string(),
    code: z.string().optional(),
  })
  .passthrough();

/** Schema for the competition list response. */
export const CompetitionListSchema = z
  .object({
    competitions: z.array(CompetitionSchema),
  })
  .passthrough();

/** Inferred type for a single competition. */
export type Competition = z.infer<typeof CompetitionSchema>;

/** Inferred type for the competition list response. */
export type CompetitionList = z.infer<typeof CompetitionListSchema>;

// ---------------------------------------------------------------------------
// Compseason list (/afl/v2/competitions/{compId}/compseasons)
// ---------------------------------------------------------------------------

/** Schema for a single compseason (competition-season) entry. */
export const CompseasonSchema = z
  .object({
    id: z.number(),
    name: z.string(),
    shortName: z.string().optional(),
    currentRoundNumber: z.number().optional(),
  })
  .passthrough();

/** Schema for the compseason list response. */
export const CompseasonListSchema = z
  .object({
    compSeasons: z.array(CompseasonSchema),
  })
  .passthrough();

/** Inferred type for a single compseason. */
export type Compseason = z.infer<typeof CompseasonSchema>;

/** Inferred type for the compseason list response. */
export type CompseasonList = z.infer<typeof CompseasonListSchema>;

// ---------------------------------------------------------------------------
// Round list (/afl/v2/compseasons/{seasonId}/rounds)
// ---------------------------------------------------------------------------

/** Schema for a single round entry. */
export const RoundSchema = z
  .object({
    id: z.number(),
    /** Provider ID used by /cfs/ endpoints (e.g. "CD_R202501401"). */
    providerId: z.string().optional(),
    name: z.string(),
    abbreviation: z.string().optional(),
    roundNumber: z.number(),
    utcStartTime: z.string().optional(),
    utcEndTime: z.string().optional(),
  })
  .passthrough();

/** Schema for the round list response. */
export const RoundListSchema = z
  .object({
    rounds: z.array(RoundSchema),
  })
  .passthrough();

/** Inferred type for a single round. */
export type Round = z.infer<typeof RoundSchema>;

/** Inferred type for the round list response. */
export type RoundList = z.infer<typeof RoundListSchema>;

// ---------------------------------------------------------------------------
// Shared /cfs/ score schemas
// ---------------------------------------------------------------------------

/** Schema for a goals/behinds/total score object (used in match and period scores). */
export const ScoreSchema = z
  .object({
    totalScore: z.number(),
    goals: z.number(),
    behinds: z.number(),
    superGoals: z.number().nullable().optional(),
  })
  .passthrough();

/** Schema for a period (quarter) score entry within a match. */
export const PeriodScoreSchema = z
  .object({
    periodNumber: z.number(),
    score: ScoreSchema,
  })
  .passthrough();

/** Schema for a team's total score (match + period breakdown). */
export const TeamScoreSchema = z
  .object({
    matchScore: ScoreSchema,
    periodScore: z.array(PeriodScoreSchema).optional(),
    rushedBehinds: z.number().optional(),
    minutesInFront: z.number().optional(),
  })
  .passthrough();

/** Inferred type for a score object. */
export type Score = z.infer<typeof ScoreSchema>;

/** Inferred type for a period score. */
export type PeriodScore = z.infer<typeof PeriodScoreSchema>;

/** Inferred type for a team score. */
export type TeamScore = z.infer<typeof TeamScoreSchema>;

// ---------------------------------------------------------------------------
// /cfs/ match team schema (nested within match items)
// ---------------------------------------------------------------------------

/** Schema for a team entry within a /cfs/ match object. */
export const CfsMatchTeamSchema = z
  .object({
    name: z.string(),
    teamId: z.string(),
    abbr: z.string().optional(),
    nickname: z.string().optional(),
  })
  .passthrough();

/** Inferred type for a /cfs/ match team. */
export type CfsMatchTeam = z.infer<typeof CfsMatchTeamSchema>;

// ---------------------------------------------------------------------------
// /cfs/ match inner object (nested within match items)
// ---------------------------------------------------------------------------

/** Schema for the inner match object within a /cfs/ match item. */
export const CfsMatchSchema = z
  .object({
    matchId: z.string(),
    name: z.string().optional(),
    status: z.string(),
    utcStartTime: z.string(),
    homeTeamId: z.string(),
    awayTeamId: z.string(),
    homeTeam: CfsMatchTeamSchema,
    awayTeam: CfsMatchTeamSchema,
    round: z.string().optional(),
    abbr: z.string().optional(),
  })
  .passthrough();

/** Inferred type for a /cfs/ match. */
export type CfsMatch = z.infer<typeof CfsMatchSchema>;

// ---------------------------------------------------------------------------
// /cfs/ score wrapper (nested within match items)
// ---------------------------------------------------------------------------

/** Schema for the score wrapper within a /cfs/ match item. */
export const CfsScoreSchema = z
  .object({
    status: z.string(),
    matchId: z.string(),
    homeTeamScore: TeamScoreSchema,
    awayTeamScore: TeamScoreSchema,
  })
  .passthrough();

/** Inferred type for a /cfs/ score wrapper. */
export type CfsScore = z.infer<typeof CfsScoreSchema>;

// ---------------------------------------------------------------------------
// /cfs/ venue schema
// ---------------------------------------------------------------------------

/** Schema for venue info in /cfs/ responses. */
export const CfsVenueSchema = z
  .object({
    name: z.string(),
    venueId: z.string().optional(),
    state: z.string().optional(),
    timeZone: z.string().optional(),
  })
  .passthrough();

/** Inferred type for a /cfs/ venue. */
export type CfsVenue = z.infer<typeof CfsVenueSchema>;

// ---------------------------------------------------------------------------
// Match items — round results (/cfs/afl/matchItems/round/{roundProviderId})
// ---------------------------------------------------------------------------

/** Schema for a single match item in round results. */
export const MatchItemSchema = z
  .object({
    match: CfsMatchSchema,
    score: CfsScoreSchema.optional(),
    venue: CfsVenueSchema.optional(),
    round: z
      .object({
        name: z.string(),
        roundId: z.string(),
        roundNumber: z.number(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

/** Schema for the match items (round results) response. */
export const MatchItemListSchema = z
  .object({
    roundId: z.string().optional(),
    items: z.array(MatchItemSchema),
  })
  .passthrough();

/** Inferred type for a single match item. */
export type MatchItem = z.infer<typeof MatchItemSchema>;

/** Inferred type for the match items list response. */
export type MatchItemList = z.infer<typeof MatchItemListSchema>;

// ---------------------------------------------------------------------------
// Player stats (/cfs/afl/playerStats/match/{matchProviderId})
// ---------------------------------------------------------------------------

/** Schema for the inner player identity within player stats. */
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
    playerJumperNumber: z.number().optional(),
  })
  .passthrough();

/** Schema for stat values (clearances is nested). */
export const PlayerGameStatsSchema = z
  .object({
    goals: z.number().optional(),
    behinds: z.number().optional(),
    kicks: z.number().optional(),
    handballs: z.number().optional(),
    disposals: z.number().optional(),
    marks: z.number().optional(),
    bounces: z.number().optional(),
    tackles: z.number().optional(),
    contestedPossessions: z.number().optional(),
    uncontestedPossessions: z.number().optional(),
    totalPossessions: z.number().optional(),
    inside50s: z.number().optional(),
    marksInside50: z.number().optional(),
    contestedMarks: z.number().optional(),
    hitouts: z.number().optional(),
    onePercenters: z.number().optional(),
    disposalEfficiency: z.number().optional(),
    clangers: z.number().optional(),
    freesFor: z.number().optional(),
    freesAgainst: z.number().optional(),
    dreamTeamPoints: z.number().optional(),
    clearances: z
      .object({
        centreClearances: z.number().optional(),
        stoppageClearances: z.number().optional(),
        totalClearances: z.number().optional(),
      })
      .passthrough()
      .optional(),
    rebound50s: z.number().optional(),
    goalAssists: z.number().optional(),
    goalAccuracy: z.number().optional(),
    turnovers: z.number().optional(),
    intercepts: z.number().optional(),
    tacklesInside50: z.number().optional(),
    shotsAtGoal: z.number().optional(),
    metresGained: z.number().optional(),
    scoreInvolvements: z.number().optional(),
    timeOnGroundPercentage: z.number().optional(),
    ratingPoints: z.number().optional(),
    extendedStats: z
      .object({
        effectiveDisposals: z.number().optional(),
        effectiveKicks: z.number().optional(),
        kickEfficiency: z.number().optional(),
        kickToHandballRatio: z.number().optional(),
        pressureActs: z.number().optional(),
        defHalfPressureActs: z.number().optional(),
        spoils: z.number().optional(),
        hitoutsToAdvantage: z.number().optional(),
        hitoutWinPercentage: z.number().optional(),
        hitoutToAdvantageRate: z.number().optional(),
        groundBallGets: z.number().optional(),
        f50GroundBallGets: z.number().optional(),
        interceptMarks: z.number().optional(),
        marksOnLead: z.number().optional(),
        contestedPossessionRate: z.number().optional(),
        contestOffOneOnOnes: z.number().optional(),
        contestOffWins: z.number().optional(),
        contestOffWinsPercentage: z.number().optional(),
        contestDefOneOnOnes: z.number().optional(),
        contestDefLosses: z.number().optional(),
        contestDefLossPercentage: z.number().optional(),
        centreBounceAttendances: z.number().optional(),
        kickins: z.number().optional(),
        kickinsPlayon: z.number().optional(),
        ruckContests: z.number().optional(),
        scoreLaunches: z.number().optional(),
      })
      .passthrough()
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
        jumperNumber: z.number().optional(),
      })
      .passthrough(),
    teamId: z.string(),
    playerStats: z
      .object({
        stats: PlayerGameStatsSchema,
      })
      .passthrough(),
  })
  .passthrough();

/** Schema for the player stats response. */
export const PlayerStatsListSchema = z
  .object({
    homeTeamPlayerStats: z.array(PlayerStatsItemSchema),
    awayTeamPlayerStats: z.array(PlayerStatsItemSchema),
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
    jumperNumber: z.number().optional(),
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

// ---------------------------------------------------------------------------
// Team list (/afl/v2/teams)
// ---------------------------------------------------------------------------

/** Schema for a single team entry. */
export const TeamItemSchema = z
  .object({
    id: z.number(),
    name: z.string(),
    abbreviation: z.string().optional(),
    teamType: z.string().optional(),
  })
  .passthrough();

/** Schema for the team list response. */
export const TeamListSchema = z
  .object({
    teams: z.array(TeamItemSchema),
  })
  .passthrough();

/** Inferred type for a single team item. */
export type TeamItem = z.infer<typeof TeamItemSchema>;

/** Inferred type for the team list response. */
export type TeamList = z.infer<typeof TeamListSchema>;

// ---------------------------------------------------------------------------
// Squad (/afl/v2/squads?teamId={}&compSeasonId={})
// ---------------------------------------------------------------------------

/** Schema for a player's inner identity within a squad. */
export const SquadPlayerInnerSchema = z
  .object({
    id: z.number(),
    providerId: z.string().optional(),
    firstName: z.string(),
    surname: z.string(),
    dateOfBirth: z.string().optional(),
    heightInCm: z.number().optional(),
    weightInKg: z.number().optional(),
  })
  .passthrough();

/** Schema for a single squad player entry. */
export const SquadPlayerItemSchema = z
  .object({
    player: SquadPlayerInnerSchema,
    jumperNumber: z.number().optional(),
    position: z.string().optional(),
  })
  .passthrough();

/** Schema for the squad wrapper object. */
export const SquadSchema = z
  .object({
    team: z
      .object({
        name: z.string(),
      })
      .passthrough()
      .optional(),
    players: z.array(SquadPlayerItemSchema),
  })
  .passthrough();

/** Schema for the squad response. */
export const SquadListSchema = z
  .object({
    squad: SquadSchema,
  })
  .passthrough();

/** Inferred type for a single squad player item. */
export type SquadPlayerItem = z.infer<typeof SquadPlayerItemSchema>;

/** Inferred type for the squad response. */
export type SquadList = z.infer<typeof SquadListSchema>;

// ---------------------------------------------------------------------------
// Ladder (/afl/v2/compseasons/{seasonId}/ladders)
// ---------------------------------------------------------------------------

/** Schema for a win/loss/draw record. */
const WinLossRecordSchema = z
  .object({
    wins: z.number(),
    losses: z.number(),
    draws: z.number(),
    played: z.number().optional(),
  })
  .passthrough();

/** Schema for a single ladder entry from the AFL API. */
export const LadderEntryRawSchema = z
  .object({
    position: z.number(),
    team: z
      .object({
        name: z.string(),
        id: z.number().optional(),
        abbreviation: z.string().optional(),
      })
      .passthrough(),
    played: z.number().optional(),
    pointsFor: z.number().optional(),
    pointsAgainst: z.number().optional(),
    thisSeasonRecord: z
      .object({
        aggregatePoints: z.number().optional(),
        percentage: z.number().optional(),
        winLossRecord: WinLossRecordSchema.optional(),
      })
      .passthrough()
      .optional(),
    form: z.string().optional(),
  })
  .passthrough();

/** Schema for the ladder API response. */
export const LadderResponseSchema = z
  .object({
    ladders: z.array(
      z
        .object({
          entries: z.array(LadderEntryRawSchema),
        })
        .passthrough(),
    ),
    round: z
      .object({
        roundNumber: z.number(),
        name: z.string().optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

/** Inferred type for a raw ladder entry. */
export type LadderEntryRaw = z.infer<typeof LadderEntryRawSchema>;

/** Inferred type for the ladder API response. */
export type LadderResponse = z.infer<typeof LadderResponseSchema>;
