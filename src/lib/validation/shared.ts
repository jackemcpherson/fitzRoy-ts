/**
 * Shared Zod primitives used across validation modules.
 *
 * Schemas here are referenced by more than one upstream sub-surface
 * (e.g. /cfs/ match items and /cfs/ player stats both reuse `statNum`
 * and the score wrappers). Keep this file small — anything specific to
 * a single upstream belongs in its own module.
 */

import { z } from "zod/v4";

/** Nullable number — AFLW responses may return `null`, string-encoded, or boolean stat fields. */
export const statNum = z
  .union([
    z.number(),
    z.string().transform((s) => {
      if (s === "" || s === "-") return null;
      const n = Number(s);
      return Number.isNaN(n) ? null : n;
    }),
    z.boolean().transform((b) => (b ? 1 : 0)),
  ])
  .nullable()
  .optional();

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
