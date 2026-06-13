/**
 * Zod schemas for the AFL API v2 REST surface.
 *
 * Covers the metadata endpoints (token, competitions, compseasons,
 * rounds, teams, squads, ladders) returned by `aflapi.afl.com.au/afl/v2`.
 * The match-level /cfs/ surface lives in `./afl-api-cfs`.
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
    draftYear: z.string().optional(),
    draftPosition: z.string().optional(),
    draftType: z.string().optional(),
    debutYear: z.string().optional(),
    recruitedFrom: z.string().optional(),
  })
  .passthrough();

/** Schema for a single squad player entry. */
export const SquadPlayerItemSchema = z
  .object({
    player: SquadPlayerInnerSchema,
    jumperNumber: z.number().nullable().optional(),
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
