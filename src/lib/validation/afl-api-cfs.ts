/**
 * Zod schemas for the AFL API /cfs/ match surface.
 *
 * Covers the match-level endpoints behind `api.afl.com.au/cfs/` —
 * match items (round results) and the nested venue / weather /
 * match-clock objects they share. Player-level schemas (stats, roster)
 * live in `./afl-api-players`.
 *
 * Schemas use `.passthrough()` to tolerate extra fields the API may add
 * without breaking validation.
 */

import { z } from "zod/v4";
import { TeamScoreSchema } from "./shared";

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
    /** Wall-clock start at the venue (no offset) — captured for #109. */
    venueLocalStartTime: z.string().nullish(),
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

/** Schema for a single quarter in the /cfs/ match-clock period list (#145). */
export const CfsMatchClockPeriodSchema = z
  .object({
    periodNumber: z.number(),
    periodSeconds: z.number().nullish(),
    periodCompleted: z.boolean(),
    periodStart: z.string().nullish(),
    nextPeriodStart: z.string().nullish(),
  })
  .passthrough();

/** Schema for the score wrapper within a /cfs/ match item. */
export const CfsScoreSchema = z
  .object({
    status: z.string(),
    matchId: z.string(),
    homeTeamScore: TeamScoreSchema,
    awayTeamScore: TeamScoreSchema,
    matchClock: z
      .object({
        periods: z.array(CfsMatchClockPeriodSchema),
      })
      .passthrough()
      .nullish(),
  })
  .passthrough();

/** Inferred type for a /cfs/ score wrapper. */
export type CfsScore = z.infer<typeof CfsScoreSchema>;

/** Inferred type for a /cfs/ match-clock period. */
export type CfsMatchClockPeriod = z.infer<typeof CfsMatchClockPeriodSchema>;

// ---------------------------------------------------------------------------
// /cfs/ venue schema
// ---------------------------------------------------------------------------

/** Schema for venue info in /cfs/ responses. */
export const CfsVenueSchema = z
  .object({
    name: z.string(),
    venueId: z.string().nullish(),
    state: z.string().nullish(),
    timeZone: z.string().nullish(),
  })
  .passthrough();

/** Inferred type for a /cfs/ venue. */
export type CfsVenue = z.infer<typeof CfsVenueSchema>;

// ---------------------------------------------------------------------------
// Match items — round results (/cfs/afl/matchItems/round/{roundProviderId})
// ---------------------------------------------------------------------------

/** Schema for weather info in /cfs/ match items. */
export const CfsWeatherSchema = z
  .object({
    tempInCelsius: z.number().nullable().optional(),
    weatherType: z.string().nullable().optional(),
  })
  .passthrough();

/** Inferred type for /cfs/ weather. */
export type CfsWeather = z.infer<typeof CfsWeatherSchema>;

/** Schema for a single match item in round results. */
export const MatchItemSchema = z
  .object({
    match: CfsMatchSchema,
    score: CfsScoreSchema.nullish(),
    venue: CfsVenueSchema.optional(),
    round: z
      .object({
        name: z.string(),
        roundId: z.string(),
        roundNumber: z.number(),
      })
      .passthrough()
      .optional(),
    attendance: z.number().nullable().optional(),
    weather: CfsWeatherSchema.nullable().optional(),
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
