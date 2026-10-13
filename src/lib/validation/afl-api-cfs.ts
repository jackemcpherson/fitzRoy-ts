/**
 * Effect schemas for the AFL API /cfs/ match surface.
 *
 * Covers the match-level endpoints behind `api.afl.com.au/cfs/` —
 * match items (round results) and the nested venue / weather /
 * match-clock objects they share. Player-level schemas (stats, roster)
 * live in `./afl-api-players`.
 *
 * Schemas use `open()` to tolerate extra fields the API may add
 * without breaking validation.
 */

import { Schema } from "effect";
import { open, TeamScoreSchema } from "./shared";

// ---------------------------------------------------------------------------
// /cfs/ match team schema (nested within match items)
// ---------------------------------------------------------------------------

/** Schema for a team entry within a /cfs/ match object. */
export const CfsMatchTeamSchema = open({
  name: Schema.String,
  teamId: Schema.String,
  abbr: Schema.optional(Schema.String),
  nickname: Schema.optional(Schema.String),
});

/** Inferred type for a /cfs/ match team. */
export type CfsMatchTeam = typeof CfsMatchTeamSchema.Type;

// ---------------------------------------------------------------------------
// /cfs/ match inner object (nested within match items)
// ---------------------------------------------------------------------------

/** Schema for the inner match object within a /cfs/ match item. */
export const CfsMatchSchema = open({
  matchId: Schema.String,
  name: Schema.optional(Schema.String),
  status: Schema.String,
  utcStartTime: Schema.String,
  /** Wall-clock start at the venue (no offset) — captured for #109. */
  venueLocalStartTime: Schema.optional(Schema.NullOr(Schema.String)),
  homeTeamId: Schema.String,
  awayTeamId: Schema.String,
  homeTeam: CfsMatchTeamSchema,
  awayTeam: CfsMatchTeamSchema,
  round: Schema.optional(Schema.String),
  abbr: Schema.optional(Schema.String),
});

/** Inferred type for a /cfs/ match. */
export type CfsMatch = typeof CfsMatchSchema.Type;

// ---------------------------------------------------------------------------
// /cfs/ score wrapper (nested within match items)
// ---------------------------------------------------------------------------

/** Schema for a single quarter in the /cfs/ match-clock period list (#145). */
export const CfsMatchClockPeriodSchema = open({
  periodNumber: Schema.Number,
  periodSeconds: Schema.optional(Schema.NullOr(Schema.Number)),
  periodCompleted: Schema.Boolean,
  periodStart: Schema.optional(Schema.NullOr(Schema.String)),
  nextPeriodStart: Schema.optional(Schema.NullOr(Schema.String)),
});

/** Schema for the score wrapper within a /cfs/ match item. */
export const CfsScoreSchema = open({
  status: Schema.String,
  matchId: Schema.String,
  homeTeamScore: TeamScoreSchema,
  awayTeamScore: TeamScoreSchema,
  matchClock: Schema.optional(
    Schema.NullOr(
      open({
        periods: Schema.Array(CfsMatchClockPeriodSchema),
      }),
    ),
  ),
});

/** Inferred type for a /cfs/ score wrapper. */
export type CfsScore = typeof CfsScoreSchema.Type;

/** Inferred type for a /cfs/ match-clock period. */
export type CfsMatchClockPeriod = typeof CfsMatchClockPeriodSchema.Type;

// ---------------------------------------------------------------------------
// /cfs/ venue schema
// ---------------------------------------------------------------------------

/** Schema for venue info in /cfs/ responses. */
export const CfsVenueSchema = open({
  name: Schema.String,
  venueId: Schema.optional(Schema.NullOr(Schema.String)),
  state: Schema.optional(Schema.NullOr(Schema.String)),
  timeZone: Schema.optional(Schema.NullOr(Schema.String)),
});

/** Inferred type for a /cfs/ venue. */
export type CfsVenue = typeof CfsVenueSchema.Type;

// ---------------------------------------------------------------------------
// Match items — round results (/cfs/afl/matchItems/round/{roundProviderId})
// ---------------------------------------------------------------------------

/** Schema for weather info in /cfs/ match items. */
export const CfsWeatherSchema = open({
  tempInCelsius: Schema.optional(Schema.NullOr(Schema.Number)),
  weatherType: Schema.optional(Schema.NullOr(Schema.String)),
});

/** Inferred type for /cfs/ weather. */
export type CfsWeather = typeof CfsWeatherSchema.Type;

/** Schema for a single match item in round results. */
export const MatchItemSchema = open({
  match: CfsMatchSchema,
  score: Schema.optional(Schema.NullOr(CfsScoreSchema)),
  venue: Schema.optional(CfsVenueSchema),
  round: Schema.optional(
    open({
      name: Schema.String,
      roundId: Schema.String,
      roundNumber: Schema.Number,
    }),
  ),
  attendance: Schema.optional(Schema.NullOr(Schema.Number)),
  weather: Schema.optional(Schema.NullOr(CfsWeatherSchema)),
});

/** Schema for the match items (round results) response. */
export const MatchItemListSchema = open({
  roundId: Schema.optional(Schema.String),
  items: Schema.Array(MatchItemSchema),
});

/** Inferred type for a single match item. */
export type MatchItem = typeof MatchItemSchema.Type;

/** Inferred type for the match items list response. */
export type MatchItemList = typeof MatchItemListSchema.Type;
