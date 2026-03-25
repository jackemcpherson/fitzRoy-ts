/**
 * Shared domain types for fitzRoy-ts.
 *
 * Define all domain types here before writing implementation code.
 * Types are the single source of truth for the data model.
 */

/** Cloudflare Workers environment bindings. */
export interface Env {
  DB: D1Database;
}
