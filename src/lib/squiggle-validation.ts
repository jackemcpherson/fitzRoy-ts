/**
 * Zod schemas for Squiggle API responses.
 *
 * @see https://api.squiggle.com.au/
 */

import { z } from "zod";

/** A single game from the Squiggle API. */
export const SquiggleGameSchema = z.object({
  id: z.number(),
  year: z.number(),
  round: z.number(),
  roundname: z.string(),
  hteam: z.string(),
  ateam: z.string(),
  hteamid: z.number(),
  ateamid: z.number(),
  hscore: z.number().nullable(),
  ascore: z.number().nullable(),
  hgoals: z.number().nullable(),
  agoals: z.number().nullable(),
  hbehinds: z.number().nullable(),
  abehinds: z.number().nullable(),
  winner: z.string().nullable(),
  winnerteamid: z.number().nullable(),
  venue: z.string(),
  date: z.string(),
  localtime: z.string(),
  tz: z.string(),
  unixtime: z.number(),
  timestr: z.string().nullable(),
  complete: z.number(),
  is_final: z.number(),
  is_grand_final: z.number(),
  updated: z.string(),
});

export type SquiggleGame = z.infer<typeof SquiggleGameSchema>;

/** Response wrapper for Squiggle games query. */
export const SquiggleGamesResponseSchema = z.object({
  games: z.array(SquiggleGameSchema),
});

export type SquiggleGamesResponse = z.infer<typeof SquiggleGamesResponseSchema>;

/** A single standing from the Squiggle API. */
export const SquiggleStandingSchema = z.object({
  id: z.number(),
  name: z.string(),
  rank: z.number(),
  played: z.number(),
  wins: z.number(),
  losses: z.number(),
  draws: z.number(),
  pts: z.number(),
  for: z.number(),
  against: z.number(),
  percentage: z.number(),
  goals_for: z.number(),
  goals_against: z.number(),
  behinds_for: z.number(),
  behinds_against: z.number(),
});

export type SquiggleStanding = z.infer<typeof SquiggleStandingSchema>;

/** Response wrapper for Squiggle standings query. */
export const SquiggleStandingsResponseSchema = z.object({
  standings: z.array(SquiggleStandingSchema),
});

export type SquiggleStandingsResponse = z.infer<typeof SquiggleStandingsResponseSchema>;
