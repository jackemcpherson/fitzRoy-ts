/**
 * Effect schemas for Squiggle API responses.
 *
 * @see https://api.squiggle.com.au/
 */

import { Schema } from "effect";

/** A single game from the Squiggle API. */
export const SquiggleGameSchema = Schema.Struct({
  id: Schema.Number,
  year: Schema.Number,
  round: Schema.Number,
  roundname: Schema.String,
  hteam: Schema.String,
  ateam: Schema.String,
  hteamid: Schema.Number,
  ateamid: Schema.Number,
  hscore: Schema.NullOr(Schema.Number),
  ascore: Schema.NullOr(Schema.Number),
  hgoals: Schema.NullOr(Schema.Number),
  agoals: Schema.NullOr(Schema.Number),
  hbehinds: Schema.NullOr(Schema.Number),
  abehinds: Schema.NullOr(Schema.Number),
  winner: Schema.NullOr(Schema.String),
  winnerteamid: Schema.NullOr(Schema.Number),
  venue: Schema.String,
  date: Schema.String,
  localtime: Schema.String,
  tz: Schema.String,
  unixtime: Schema.Number,
  timestr: Schema.NullOr(Schema.String),
  complete: Schema.Number,
  is_final: Schema.Number,
  is_grand_final: Schema.Number,
  updated: Schema.String,
});

export type SquiggleGame = typeof SquiggleGameSchema.Type;

/** Response wrapper for Squiggle games query. */
export const SquiggleGamesResponseSchema = Schema.Struct({
  games: Schema.Array(SquiggleGameSchema),
});

export type SquiggleGamesResponse = typeof SquiggleGamesResponseSchema.Type;

/** A single standing from the Squiggle API. */
export const SquiggleStandingSchema = Schema.Struct({
  id: Schema.Number,
  name: Schema.String,
  rank: Schema.Number,
  played: Schema.Number,
  wins: Schema.Number,
  losses: Schema.Number,
  draws: Schema.Number,
  pts: Schema.Number,
  for: Schema.Number,
  against: Schema.Number,
  percentage: Schema.Number,
  goals_for: Schema.Number,
  goals_against: Schema.Number,
  behinds_for: Schema.Number,
  behinds_against: Schema.Number,
});

export type SquiggleStanding = typeof SquiggleStandingSchema.Type;

/** Response wrapper for Squiggle standings query. */
export const SquiggleStandingsResponseSchema = Schema.Struct({
  standings: Schema.Array(SquiggleStandingSchema),
});

export type SquiggleStandingsResponse = typeof SquiggleStandingsResponseSchema.Type;
