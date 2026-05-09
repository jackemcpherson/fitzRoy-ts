/**
 * Pure transforms over Squad data.
 *
 * Since 2.1.0 `Player` is the canonical record and `Squad.players` is
 * already `Player[]`. This helper flips the requested `source` onto each
 * player (callers may want to override the source when projecting a
 * squad through a different lens) but otherwise passes through.
 */

import type { DataSource, Player, Squad } from "../types";

/**
 * Project a `Squad` into a flat `Player[]` view, optionally overriding
 * the per-player `source` field.
 */
export function squadToPlayerDetails(squad: Squad, source: DataSource): Player[] {
  return squad.players.map((p) => ({ ...p, source }));
}
