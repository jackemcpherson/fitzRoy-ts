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
  ["Brisbane Lions", "Brisbane", "Brisbane Bears", "Bears", "Fitzroy Lions", "BL", "BRIS"],
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
