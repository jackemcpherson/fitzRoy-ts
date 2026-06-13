/**
 * Zod schemas for validating AFL API response shapes at the boundary.
 *
 * Schemas are grouped by upstream sub-surface and re-exported here so
 * the historical `from "../lib/validation"` import path keeps working.
 *
 * - `./shared` — primitives reused across modules (score wrappers, statNum)
 * - `./afl-api-core` — AFL API v2 REST surface (token, competitions,
 *   compseasons, rounds, teams, squads, ladders)
 * - `./afl-api-cfs` — AFL API /cfs/ match surface (match items, venue,
 *   weather, match-clock)
 * - `./afl-api-players` — AFL API /cfs/ player surface (player stats,
 *   full match roster)
 */

export * from "./afl-api-cfs";
export * from "./afl-api-core";
export * from "./afl-api-players";
export * from "./shared";
