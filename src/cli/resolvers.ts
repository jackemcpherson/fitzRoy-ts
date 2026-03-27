/**
 * Interactive CLI resource resolvers with fuzzy matching.
 *
 * Wraps the deterministic resolution functions from `validation.ts` with
 * fuzzy search fallback and `@clack/prompts` interactive disambiguation
 * when running in a TTY.
 */

import { isCancel, select } from "@clack/prompts";
import { fuzzySearch } from "../lib/fuzzy";
import { AFL_SENIOR_TEAMS, normaliseTeamName } from "../lib/team-mapping";
import type { MatchItem } from "../lib/validation";
import { resolveMatchByTeam, resolveTeamIdentifier } from "./validation";

const isTTY = process.stdout.isTTY === true;

/** Minimal team shape accepted by the resolver. */
interface TeamCandidate {
  readonly teamId: string;
  readonly name: string;
  readonly abbreviation: string;
}

/**
 * Resolve a team query to a numeric team ID, with fuzzy matching and
 * interactive disambiguation.
 *
 * Tries deterministic resolution first via {@link resolveTeamIdentifier},
 * then falls back to fuzzy search with interactive prompts.
 *
 * @param query - User-provided team text (name, abbreviation, or ID).
 * @param teams - Available teams to match against.
 * @returns The resolved numeric team ID string.
 */
export async function resolveTeamOrPrompt(
  query: string,
  teams: readonly TeamCandidate[],
): Promise<string> {
  try {
    return resolveTeamIdentifier(query, teams);
  } catch {
    // Fall through to fuzzy search
  }

  const matches = fuzzySearch(query.trim(), teams, (t) => t.name, {
    maxResults: 5,
    threshold: 0.4,
  });

  const abbrevMatches = fuzzySearch(query.trim(), teams, (t) => t.abbreviation, {
    maxResults: 5,
    threshold: 0.4,
  });

  const seen = new Set(matches.map((m) => m.item.teamId));
  for (const m of abbrevMatches) {
    if (!seen.has(m.item.teamId)) {
      matches.push(m);
      seen.add(m.item.teamId);
    }
  }

  matches.sort((a, b) => a.score - b.score);

  return disambiguate(
    query.trim(),
    matches.map((m) => ({ value: m.item.teamId, label: m.item.name, score: m.score })),
    teams.map((t) => `${t.name} (${t.abbreviation})`),
    "team",
  );
}

/**
 * Resolve a team query to a canonical team name using the alias map,
 * with fuzzy matching fallback. Does not require an API call.
 *
 * Used by commands that pass team names to library functions
 * (e.g. `player-details`, `coaches-votes`).
 *
 * @param query - User-provided team text.
 * @param teamNames - Optional explicit list of team names to search. Defaults to AFL senior teams.
 * @returns The resolved canonical team name.
 */
export async function resolveTeamNameOrPrompt(
  query: string,
  teamNames?: readonly string[],
): Promise<string> {
  const trimmed = query.trim();

  // Check alias map — handles both aliases and exact canonical names
  const canonical = normaliseTeamName(trimmed);
  const candidates = teamNames ?? [...AFL_SENIOR_TEAMS];

  if (candidates.includes(canonical)) {
    return canonical;
  }

  const items = candidates.map((name) => ({ name }));
  const matches = fuzzySearch(trimmed, items, (t) => t.name, {
    maxResults: 5,
    threshold: 0.4,
  });

  return disambiguate(
    trimmed,
    matches.map((m) => ({ value: m.item.name, label: m.item.name, score: m.score })),
    candidates,
    "team",
  );
}

/**
 * Resolve a match query (team name) to a match ID, with fuzzy matching
 * and interactive disambiguation.
 *
 * Tries exact resolution first via {@link resolveMatchByTeam},
 * then falls back to fuzzy search with interactive prompts.
 *
 * @param query - User-provided team name to find the match for.
 * @param matchItems - Available matches in the round.
 * @returns The resolved match ID.
 */
export async function resolveMatchOrPrompt(
  query: string,
  matchItems: readonly MatchItem[],
): Promise<string> {
  try {
    return resolveMatchByTeam(query, matchItems);
  } catch {
    // Fall through to fuzzy search
  }

  const labelledItems = matchItems.map((item) => ({
    item,
    label: `${normaliseTeamName(item.match.homeTeam.name)} vs ${normaliseTeamName(item.match.awayTeam.name)}`,
  }));

  const matches = fuzzySearch(query, labelledItems, (l) => l.label, {
    maxResults: 5,
    threshold: 0.5,
  });

  const homeMatches = fuzzySearch(query, matchItems, (i) => i.match.homeTeam.name, {
    maxResults: 5,
    threshold: 0.4,
  });
  const awayMatches = fuzzySearch(query, matchItems, (i) => i.match.awayTeam.name, {
    maxResults: 5,
    threshold: 0.4,
  });

  const seen = new Set(matches.map((m) => m.item.item.match.matchId));
  for (const m of homeMatches) {
    if (!seen.has(m.item.match.matchId)) {
      const label = `${normaliseTeamName(m.item.match.homeTeam.name)} vs ${normaliseTeamName(m.item.match.awayTeam.name)}`;
      matches.push({ item: { item: m.item, label }, score: m.score });
      seen.add(m.item.match.matchId);
    }
  }
  for (const m of awayMatches) {
    if (!seen.has(m.item.match.matchId)) {
      const label = `${normaliseTeamName(m.item.match.homeTeam.name)} vs ${normaliseTeamName(m.item.match.awayTeam.name)}`;
      matches.push({ item: { item: m.item, label }, score: m.score });
      seen.add(m.item.match.matchId);
    }
  }

  matches.sort((a, b) => a.score - b.score);

  const available = matchItems.map(
    (item) =>
      `${normaliseTeamName(item.match.homeTeam.name)} vs ${normaliseTeamName(item.match.awayTeam.name)}`,
  );

  return disambiguate(
    query,
    matches.map((m) => ({
      value: m.item.item.match.matchId,
      label: m.item.label,
      score: m.score,
    })),
    available,
    "match",
  );
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface DisambiguationOption {
  readonly value: string;
  readonly label: string;
  readonly score: number;
}

/**
 * Core disambiguation logic shared by all resolvers.
 *
 * @param query - Original search term (for error messages).
 * @param options - Scored options from fuzzy search.
 * @param allLabels - All valid labels (for error messages).
 * @param entityName - Entity type name (for error/prompt messages).
 * @returns The resolved value string.
 */
async function disambiguate(
  query: string,
  options: readonly DisambiguationOption[],
  allLabels: readonly string[],
  entityName: string,
): Promise<string> {
  const best = options[0];
  if (!best) {
    throw new Error(
      `No ${entityName} found for "${query}". Valid options: ${allLabels.join(", ")}`,
    );
  }

  if (best.score < 0.2 || options.length === 1) {
    return best.value;
  }

  if (isTTY) {
    const choice = await select({
      message: `Multiple ${entityName}s matched "${query}". Which did you mean?`,
      options: options.map((o) => ({ value: o.value, label: o.label })),
    });

    if (isCancel(choice)) {
      process.exit(0);
    }

    return choice as string;
  }

  console.error(`Matched "${query}" → ${best.label}`);
  return best.value;
}
