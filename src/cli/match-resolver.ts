/**
 * Resolve a match identifier from CLI args.
 *
 * Encapsulates the four-step dance the `team` and `stats` commands
 * previously inlined:
 *   1. Validate that `--match` was given alongside `--round`.
 *   2. Resolve season → compSeason.
 *   3. Fetch the round's matches.
 *   4. Fuzzy-match the user's `--match` text against home/away teams,
 *      prompting interactively when ambiguous.
 *
 * Centralising it gives the precondition + prompt-fallback paths a
 * single test surface (the inlined versions in command handlers were
 * untested in isolation), and ensures every command applies the
 * `--match requires --round` check uniformly.
 */

import { normaliseTeamName } from "../lib/team-mapping";
import { AflApiClient } from "../sources/afl-api";
import type { CompetitionCode } from "../types";
import { resolveMatchOrPrompt } from "./resolvers";

/** Raw inputs from the command handler. `matchIdArg` short-circuits the fetch. */
export interface MatchResolverInput {
  /** Already-resolved match ID (from `--match-id`). When set, returned as-is. */
  readonly matchIdArg?: string | undefined;
  /** Free-text team name (from `--match`) to disambiguate within the round. */
  readonly matchArg?: string | undefined;
  readonly competition: CompetitionCode;
  readonly season: number;
  readonly round: number | undefined;
}

/**
 * The match ID plus, when derivable, the participating team names.
 *
 * `participants` is populated only on the `--match <team>` path (where
 * the matched item is fetched and we know home/away). The `--match-id`
 * path returns just the opaque id — callers that need post-filtering
 * for non-afl-api sources (#123) should branch on its presence.
 */
export interface MatchResolution {
  readonly matchId: string;
  readonly participants?: {
    readonly homeTeam: string;
    readonly awayTeam: string;
  };
}

/**
 * Resolve a match ID (and, when known, the participating teams).
 *
 * Returns:
 * - `{matchId: matchIdArg}` when `matchIdArg` is set.
 * - `undefined` when neither `matchIdArg` nor `matchArg` was given.
 * - `{matchId, participants}` after fuzzy-matching `matchArg` against the
 *   round's matches.
 *
 * Throws when `matchArg` is given without `round` — the round is needed
 * to scope the match search.
 */
export async function resolveMatchId(
  input: MatchResolverInput,
): Promise<MatchResolution | undefined> {
  if (input.matchIdArg) {
    // Pre-validate the format so a malformed --match-id fails fast with a
    // clear message instead of an opaque 400 from the upstream API (#95).
    if (!/^CD_M\d+$/.test(input.matchIdArg)) {
      throw new Error(
        `Invalid --match-id "${input.matchIdArg}" — expected format like "CD_M20240140101" (provider-assigned).`,
      );
    }
    return { matchId: input.matchIdArg };
  }
  if (!input.matchArg) return undefined;

  if (input.round == null) {
    throw new Error("--match requires --round (-r) to identify which round to search.");
  }

  const client = new AflApiClient();
  const seasonResult = await client.resolveCompSeason(input.competition, input.season);
  if (!seasonResult.success) throw seasonResult.error;

  const itemsResult = await client.fetchRoundMatchItemsByNumber(seasonResult.data, input.round);
  if (!itemsResult.success) throw itemsResult.error;

  const matchId = await resolveMatchOrPrompt(input.matchArg, itemsResult.data);
  const matched = itemsResult.data.find((item) => item.match.matchId === matchId);
  if (!matched) {
    return { matchId };
  }
  return {
    matchId,
    participants: {
      homeTeam: normaliseTeamName(matched.match.homeTeam.name),
      awayTeam: normaliseTeamName(matched.match.awayTeam.name),
    },
  };
}
