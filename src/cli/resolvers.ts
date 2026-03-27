/**
 * Interactive CLI resource resolvers with fuzzy matching.
 *
 * Wraps the deterministic resolution functions from `validation.ts` with
 * fuzzy search fallback and `@clack/prompts` interactive disambiguation
 * when running in a TTY.
 */

import { isCancel, select } from "@clack/prompts";
import { fuzzySearch } from "../lib/fuzzy";
import { normaliseTeamName } from "../lib/team-mapping";
import type { MatchItem } from "../lib/validation";
import { isTTY } from "./ui";

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
 * Resolution order:
 * 1. Numeric ID passthrough
 * 2. Exact match via alias map, case-insensitive name, or abbreviation
 * 3. Fuzzy search with Levenshtein distance
 * 4. Interactive `select()` prompt if ambiguous (TTY only)
 *
 * @param query - User-provided team text (name, abbreviation, or ID).
 * @param teams - Available teams to match against.
 * @returns The resolved numeric team ID string.
 */
export async function resolveTeamOrPrompt(
  query: string,
  teams: readonly TeamCandidate[],
): Promise<string> {
  const trimmed = query.trim();

  // Numeric ID passthrough
  if (/^\d+$/.test(trimmed)) {
    return trimmed;
  }

  // Exact match: alias map → case-insensitive name → abbreviation
  const canonical = normaliseTeamName(trimmed);
  const byCanonical = teams.find((t) => t.name === canonical);
  if (byCanonical) return byCanonical.teamId;

  const lower = trimmed.toLowerCase();
  const byName = teams.find((t) => t.name.toLowerCase() === lower);
  if (byName) return byName.teamId;

  const byAbbrev = teams.find((t) => t.abbreviation.toLowerCase() === lower);
  if (byAbbrev) return byAbbrev.teamId;

  // Fuzzy search
  const matches = fuzzySearch(trimmed, [...teams], (t) => t.name, {
    maxResults: 5,
    threshold: 0.4,
  });

  // Also search abbreviations and merge unique results
  const abbrevMatches = fuzzySearch(trimmed, [...teams], (t) => t.abbreviation, {
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
    trimmed,
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
 * @param teamNames - Optional explicit list of team names to search. Defaults to the alias map.
 * @returns The resolved canonical team name.
 */
export async function resolveTeamNameOrPrompt(
  query: string,
  teamNames?: readonly string[],
): Promise<string> {
  const trimmed = query.trim();

  // Try alias map first
  const canonical = normaliseTeamName(trimmed);
  if (canonical !== trimmed) {
    return canonical;
  }

  // If explicit team names provided, fuzzy search against them
  const candidates = teamNames ?? getDefaultTeamNames();
  const items = candidates.map((name) => ({ name }));
  const matches = fuzzySearch(trimmed, items, (t) => t.name, {
    maxResults: 5,
    threshold: 0.4,
  });

  return disambiguate(
    trimmed,
    matches.map((m) => ({ value: m.item.name, label: m.item.name, score: m.score })),
    [...candidates],
    "team",
  );
}

/**
 * Resolve a match query (team name) to a match ID, with fuzzy matching
 * and interactive disambiguation.
 *
 * @param query - User-provided team name to find the match for.
 * @param matchItems - Available matches in the round.
 * @returns The resolved match ID.
 */
export async function resolveMatchOrPrompt(
  query: string,
  matchItems: readonly MatchItem[],
): Promise<string> {
  const normalised = normaliseTeamName(query);
  const lower = query.toLowerCase();

  // Try exact resolution first
  const exactMatches = matchItems.filter((item) => {
    const home = item.match.homeTeam.name;
    const away = item.match.awayTeam.name;
    return (
      normaliseTeamName(home) === normalised ||
      normaliseTeamName(away) === normalised ||
      home.toLowerCase().includes(lower) ||
      away.toLowerCase().includes(lower)
    );
  });

  if (exactMatches.length === 1 && exactMatches[0]) {
    return exactMatches[0].match.matchId;
  }

  // Fuzzy search against "Home vs Away" labels
  const labelledItems = matchItems.map((item) => ({
    item,
    label: `${item.match.homeTeam.name} vs ${item.match.awayTeam.name}`,
  }));

  const matches = fuzzySearch(query, labelledItems, (l) => l.label, {
    maxResults: 5,
    threshold: 0.5,
  });

  // Also fuzzy search against individual team names
  const homeMatches = fuzzySearch(query, [...matchItems], (i) => i.match.homeTeam.name, {
    maxResults: 5,
    threshold: 0.4,
  });
  const awayMatches = fuzzySearch(query, [...matchItems], (i) => i.match.awayTeam.name, {
    maxResults: 5,
    threshold: 0.4,
  });

  const seen = new Set(matches.map((m) => m.item.item.match.matchId));
  for (const m of homeMatches) {
    if (!seen.has(m.item.match.matchId)) {
      const label = `${m.item.match.homeTeam.name} vs ${m.item.match.awayTeam.name}`;
      matches.push({ item: { item: m.item, label }, score: m.score });
      seen.add(m.item.match.matchId);
    }
  }
  for (const m of awayMatches) {
    if (!seen.has(m.item.match.matchId)) {
      const label = `${m.item.match.homeTeam.name} vs ${m.item.match.awayTeam.name}`;
      matches.push({ item: { item: m.item, label }, score: m.score });
      seen.add(m.item.match.matchId);
    }
  }

  matches.sort((a, b) => a.score - b.score);

  const available = matchItems.map(
    (item) => `${item.match.homeTeam.name} vs ${item.match.awayTeam.name}`,
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
  if (options.length === 0) {
    throw new Error(
      `No ${entityName} found for "${query}". Valid options: ${allLabels.join(", ")}`,
    );
  }

  const best = options[0];
  if (!best) {
    throw new Error(
      `No ${entityName} found for "${query}". Valid options: ${allLabels.join(", ")}`,
    );
  }

  // High-confidence single match
  if (best.score < 0.2 || options.length === 1) {
    return best.value;
  }

  // Interactive disambiguation on TTY
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

  // Non-TTY: use best match with a note
  console.error(`Matched "${query}" → ${best.label}`);
  return best.value;
}

/** Get default team names from the alias map for fuzzy matching without API calls. */
function getDefaultTeamNames(): readonly string[] {
  return [
    "Adelaide Crows",
    "Brisbane Lions",
    "Carlton",
    "Collingwood",
    "Essendon",
    "Fremantle",
    "Geelong Cats",
    "Gold Coast Suns",
    "GWS Giants",
    "Hawthorn",
    "Melbourne",
    "North Melbourne",
    "Port Adelaide",
    "Richmond",
    "St Kilda",
    "Sydney Swans",
    "West Coast Eagles",
    "Western Bulldogs",
  ];
}
