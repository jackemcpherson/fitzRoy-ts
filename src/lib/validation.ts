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

/** Schema for the AFL API OAuth token response. */
export const AflApiTokenSchema = z
  .object({
    access_token: z.string(),
    token_type: z.string(),
    expires_in: z.number(),
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
    id: z.string(),
    name: z.string(),
    code: z.string(),
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
    id: z.string(),
    name: z.string(),
    year: z.string().optional(),
  })
  .passthrough();

/** Schema for the compseason list response. */
export const CompseasonListSchema = z
  .object({
    compseasons: z.array(CompseasonSchema),
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
    id: z.string(),
    name: z.string(),
    abbreviation: z.string().optional(),
    roundNumber: z.number(),
    /** Whether the round has been completed. */
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
// Period score (nested within match items)
// ---------------------------------------------------------------------------

/** Schema for a period (quarter) score entry within a match. */
export const PeriodScoreSchema = z
  .object({
    periodNumber: z.number(),
    periodGoals: z.number(),
    periodBehinds: z.number(),
    periodScore: z.number(),
  })
  .passthrough();

/** Inferred type for a period score. */
export type PeriodScore = z.infer<typeof PeriodScoreSchema>;

// ---------------------------------------------------------------------------
// Match team (nested within match items)
// ---------------------------------------------------------------------------

/** Schema for a team entry within a match item. */
export const MatchTeamSchema = z
  .object({
    teamId: z.string(),
    teamName: z.string(),
    teamAbbr: z.string().optional(),
    /** Total score for the match. */
    score: z
      .object({
        goals: z.number(),
        behinds: z.number(),
        totalScore: z.number(),
        superGoals: z.number().optional(),
      })
      .passthrough()
      .optional(),
    /** Per-quarter scores. */
    periodScore: z.array(PeriodScoreSchema).optional(),
  })
  .passthrough();

/** Inferred type for a match team. */
export type MatchTeam = z.infer<typeof MatchTeamSchema>;

// ---------------------------------------------------------------------------
// Match items — round results (/cfs/afl/matchItems/round/{roundId})
// ---------------------------------------------------------------------------

/** Schema for a single match item in round results. */
export const MatchItemSchema = z
  .object({
    /** Unique match identifier used for detail/stats lookups. */
    matchProviderId: z.string(),
    roundNumber: z.number(),
    /** Match status: "C" (complete), "UP" (upcoming), etc. */
    status: z.string(),
    /** UTC start time as ISO string. */
    utcStartTime: z.string(),
    /** Venue information. */
    venue: z
      .object({
        name: z.string(),
      })
      .passthrough()
      .optional(),
    /** Home and away team data. */
    homeTeam: MatchTeamSchema,
    awayTeam: MatchTeamSchema,
    /** Attendance count (may be absent for upcoming matches). */
    attendance: z.number().optional(),
  })
  .passthrough();

/** Schema for the match items (round results) response. */
export const MatchItemListSchema = z
  .object({
    items: z.array(MatchItemSchema),
  })
  .passthrough();

/** Inferred type for a single match item. */
export type MatchItem = z.infer<typeof MatchItemSchema>;

/** Inferred type for the match items list response. */
export type MatchItemList = z.infer<typeof MatchItemListSchema>;

// ---------------------------------------------------------------------------
// Single match detail (/cfs/afl/matchItem/{matchProviderId})
// ---------------------------------------------------------------------------

/** Schema for a single match detail response (same shape as MatchItem with more fields). */
export const MatchDetailSchema = MatchItemSchema.extend({
  /** Additional detail fields may be present. */
  compSeason: z
    .object({
      id: z.string(),
      name: z.string().optional(),
    })
    .passthrough()
    .optional(),
  round: z
    .object({
      id: z.string(),
      name: z.string().optional(),
      roundNumber: z.number().optional(),
    })
    .passthrough()
    .optional(),
}).passthrough();

/** Inferred type for a match detail response. */
export type MatchDetail = z.infer<typeof MatchDetailSchema>;

// ---------------------------------------------------------------------------
// Player stats (/cfs/afl/playerStats/match/{matchProviderId})
// ---------------------------------------------------------------------------

/** Schema for a single player's statistics in a match. */
export const PlayerStatsItemSchema = z
  .object({
    /** Player identification fields (prefixed with playerName. in raw API). */
    "playerName.givenName": z.string().optional(),
    "playerName.surname": z.string().optional(),
    "playerName.displayName": z.string().optional(),

    /** Player metadata. */
    playerId: z.string(),
    teamId: z.string(),
    teamName: z.string().optional(),
    jumperNumber: z.number().optional(),

    /** Core stats (prefixed with playerStats. in raw API). */
    "playerStats.kicks": z.number().optional(),
    "playerStats.handballs": z.number().optional(),
    "playerStats.disposals": z.number().optional(),
    "playerStats.marks": z.number().optional(),
    "playerStats.goals": z.number().optional(),
    "playerStats.behinds": z.number().optional(),
    "playerStats.tackles": z.number().optional(),
    "playerStats.hitouts": z.number().optional(),
    "playerStats.freesFor": z.number().optional(),
    "playerStats.freesAgainst": z.number().optional(),

    /** Contested/uncontested. */
    "playerStats.contestedPossessions": z.number().optional(),
    "playerStats.uncontestedPossessions": z.number().optional(),
    "playerStats.contestedMarks": z.number().optional(),
    "playerStats.intercepts": z.number().optional(),

    /** Clearances. */
    "playerStats.centreClearances": z.number().optional(),
    "playerStats.stoppageClearances": z.number().optional(),
    "playerStats.totalClearances": z.number().optional(),

    /** Other stats. */
    "playerStats.inside50s": z.number().optional(),
    "playerStats.rebound50s": z.number().optional(),
    "playerStats.clangers": z.number().optional(),
    "playerStats.turnovers": z.number().optional(),
    "playerStats.onePercenters": z.number().optional(),
    "playerStats.bounces": z.number().optional(),
    "playerStats.goalAssists": z.number().optional(),
    "playerStats.disposalEfficiency": z.number().optional(),
    "playerStats.metresGained": z.number().optional(),

    /** Fantasy and awards. */
    "playerStats.dreamTeamPoints": z.number().optional(),
    "playerStats.supercoachPoints": z.number().optional(),
  })
  .passthrough();

/** Schema for the player stats response. */
export const PlayerStatsListSchema = z
  .object({
    /** List of player stat entries for the match. */
    items: z.array(PlayerStatsItemSchema),
  })
  .passthrough();

/** Inferred type for a single player stats item. */
export type PlayerStatsItem = z.infer<typeof PlayerStatsItemSchema>;

/** Inferred type for the player stats list response. */
export type PlayerStatsList = z.infer<typeof PlayerStatsListSchema>;

// ---------------------------------------------------------------------------
// Match roster (/cfs/afl/matchRoster/full/{matchProviderId})
// ---------------------------------------------------------------------------

/** Schema for a player entry within a match roster. */
export const RosterPlayerSchema = z
  .object({
    playerId: z.string(),
    playerName: z
      .object({
        givenName: z.string(),
        surname: z.string(),
        displayName: z.string().optional(),
      })
      .passthrough(),
    jumperNumber: z.number().optional(),
    position: z.string().optional(),
    isEmergency: z.boolean().optional(),
    isSubstitute: z.boolean().optional(),
  })
  .passthrough();

/** Schema for a team roster within a match. */
export const TeamRosterSchema = z
  .object({
    teamId: z.string(),
    teamName: z.string(),
    players: z.array(RosterPlayerSchema),
  })
  .passthrough();

/** Schema for the full match roster response. */
export const MatchRosterSchema = z
  .object({
    homeTeam: TeamRosterSchema,
    awayTeam: TeamRosterSchema,
  })
  .passthrough();

/** Inferred type for a roster player. */
export type RosterPlayer = z.infer<typeof RosterPlayerSchema>;

/** Inferred type for a team roster. */
export type TeamRoster = z.infer<typeof TeamRosterSchema>;

/** Inferred type for the match roster response. */
export type MatchRoster = z.infer<typeof MatchRosterSchema>;

// ---------------------------------------------------------------------------
// Team list (/afl/v2/teams)
// ---------------------------------------------------------------------------

/** Schema for a single team entry. */
export const TeamItemSchema = z
  .object({
    id: z.string(),
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
// Squad (/afl/v2/squads)
// ---------------------------------------------------------------------------

/** Schema for a single squad player entry. */
export const SquadPlayerItemSchema = z
  .object({
    playerId: z.string(),
    playerName: z
      .object({
        givenName: z.string(),
        surname: z.string(),
        displayName: z.string().optional(),
      })
      .passthrough(),
    jumperNumber: z.number().optional(),
    position: z.string().optional(),
    dateOfBirth: z.string().optional(),
    heightCm: z.number().optional(),
    weightKg: z.number().optional(),
  })
  .passthrough();

/** Schema for the squad response. */
export const SquadListSchema = z
  .object({
    squad: z.array(SquadPlayerItemSchema),
  })
  .passthrough();

/** Inferred type for a single squad player item. */
export type SquadPlayerItem = z.infer<typeof SquadPlayerItemSchema>;

/** Inferred type for the squad response. */
export type SquadList = z.infer<typeof SquadListSchema>;
