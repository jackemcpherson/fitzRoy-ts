/**
 * Team name normalisation across AFL data sources.
 *
 * Maps abbreviations, short names, and historical names to the canonical
 * AFL API team names. Lookups are case-insensitive.
 *
 * @example
 * ```ts
 * normaliseTeamName("GWS");           // "GWS Giants"
 * normaliseTeamName("footscray");     // "Western Bulldogs"
 * normaliseTeamName("KANGAROOS");     // "North Melbourne"
 * normaliseTeamName("Sydney");        // "Sydney Swans"
 * ```
 */

/**
 * Canonical team names matching the AFL API convention, with aliases.
 * The first element of each tuple is the canonical name.
 */
const TEAM_ALIASES: ReadonlyArray<readonly [canonical: string, ...aliases: string[]]> = [
  ["Adelaide Crows", "Adelaide", "Crows", "ADEL", "AD"],
  ["Brisbane Lions", "Brisbane", "Brisbane Bears", "Bears", "Lions", "Fitzroy Lions", "BL", "BRIS"],
  ["Carlton", "Carlton Blues", "Blues", "CARL", "CA"],
  ["Collingwood", "Collingwood Magpies", "Magpies", "COLL", "CW"],
  ["Essendon", "Essendon Bombers", "Bombers", "ESS", "ES"],
  ["Fremantle", "Fremantle Dockers", "Dockers", "FRE", "FR"],
  ["Geelong Cats", "Geelong", "Cats", "GEEL", "GE"],
  [
    "Gold Coast Suns",
    "Gold Coast",
    "Gold Coast SUNS",
    "Gold Coast Football Club",
    "Suns",
    "GCFC",
    "GC",
  ],
  [
    "GWS Giants",
    "GWS",
    "GWS GIANTS",
    "Greater Western Sydney",
    "Giants",
    "Greater Western Sydney Giants",
    "GW",
  ],
  ["Hawthorn", "Hawthorn Hawks", "Hawks", "HAW", "HW"],
  ["Melbourne", "Melbourne Demons", "Demons", "MELB", "ME"],
  ["North Melbourne", "North Melbourne Kangaroos", "Kangaroos", "Kangas", "North", "NMFC", "NM"],
  ["Port Adelaide", "Port Adelaide Power", "Power", "Port", "PA", "PAFC"],
  ["Richmond", "Richmond Tigers", "Tigers", "RICH", "RI"],
  ["St Kilda", "St Kilda Saints", "Saints", "Saint Kilda", "STK", "SK"],
  ["Sydney Swans", "Sydney", "Swans", "South Melbourne", "South Melbourne Swans", "SYD", "SY"],
  ["West Coast Eagles", "West Coast", "Eagles", "WCE", "WC"],
  ["Western Bulldogs", "Bulldogs", "Footscray", "Footscray Bulldogs", "WB", "WBD"],

  // Historical / defunct VFL teams
  ["Fitzroy", "Fitzroy Reds", "Fitzroy Gorillas", "Fitzroy Maroons", "FI"],
  ["University", "University Blacks"],
] as const;

/** The 18 current senior AFL club names (canonical form). */
export const AFL_SENIOR_TEAMS: ReadonlySet<string> = new Set([
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
]);

/**
 * Pre-built lookup map from lowercased alias to canonical name.
 * Built once at module load time for O(1) lookups.
 */
const ALIAS_MAP: ReadonlyMap<string, string> = (() => {
  const map = new Map<string, string>();
  for (const [canonical, ...aliases] of TEAM_ALIASES) {
    map.set(canonical.toLowerCase(), canonical);
    for (const alias of aliases) {
      map.set(alias.toLowerCase(), canonical);
    }
  }
  return map;
})();

/**
 * Normalise a team name to its canonical form.
 *
 * Performs a case-insensitive lookup against all known team names,
 * abbreviations, and historical names. Returns the input unchanged
 * if no mapping is found.
 *
 * @param raw - The raw team name string from any data source.
 * @returns The canonical team name, or the trimmed input if unknown.
 */
export function normaliseTeamName(raw: string): string {
  const trimmed = raw.trim();
  return ALIAS_MAP.get(trimmed.toLowerCase()) ?? trimmed;
}

/**
 * Static mapping of AFL API team provider IDs to canonical team names.
 *
 * Used as a fallback when the match roster endpoint is unavailable,
 * ensuring player stats always show team names instead of raw IDs like `CD_T30`.
 */
export const AFL_API_TEAM_IDS: ReadonlyMap<string, string> = new Map([
  ["CD_T10", "Adelaide Crows"],
  ["CD_T20", "Brisbane Lions"],
  ["CD_T30", "Carlton"],
  ["CD_T40", "Collingwood"],
  ["CD_T50", "Essendon"],
  ["CD_T60", "Fremantle"],
  ["CD_T70", "Geelong Cats"],
  ["CD_T1000", "Gold Coast Suns"],
  ["CD_T1010", "GWS Giants"],
  ["CD_T80", "Hawthorn"],
  ["CD_T90", "Melbourne"],
  ["CD_T100", "North Melbourne"],
  ["CD_T110", "Port Adelaide"],
  ["CD_T120", "Richmond"],
  ["CD_T130", "St Kilda"],
  ["CD_T160", "Sydney Swans"],
  ["CD_T150", "West Coast Eagles"],
  ["CD_T140", "Western Bulldogs"],
]);
