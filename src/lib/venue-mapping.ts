/**
 * Venue name normalisation across AFL data sources.
 *
 * Maps sponsor names, historical names, and abbreviations to stable canonical
 * venue names. Lookups are case-insensitive.
 *
 * @example
 * ```ts
 * normaliseVenueName("GMHBA Stadium");              // "Kardinia Park"
 * normaliseVenueName("Etihad Stadium");              // "Marvel Stadium"
 * normaliseVenueName("ENGIE Stadium");               // "Sydney Showground"
 * normaliseVenueName("People First Stadium");        // "Carrara"
 * ```
 */

/**
 * Canonical venue names with aliases.
 * The first element of each tuple is the canonical name.
 *
 * Canonical names prefer stable, non-sponsor names where possible,
 * since stadium naming rights change frequently.
 */
const VENUE_ALIASES: ReadonlyArray<readonly [canonical: string, ...aliases: string[]]> = [
  ["MCG", "M.C.G.", "Melbourne Cricket Ground"],
  ["SCG", "S.C.G.", "Sydney Cricket Ground"],
  ["Marvel Stadium", "Docklands", "Etihad Stadium", "Telstra Dome", "Colonial Stadium"],
  ["Kardinia Park", "GMHBA Stadium", "Simonds Stadium", "Skilled Stadium"],
  ["Gabba", "The Gabba", "Brisbane Cricket Ground"],
  [
    "Sydney Showground",
    "ENGIE Stadium",
    "GIANTS Stadium",
    "Showground Stadium",
    "Sydney Showground Stadium",
  ],
  ["Accor Stadium", "Stadium Australia", "ANZ Stadium", "Homebush"],
  ["Carrara", "People First Stadium", "Heritage Bank Stadium", "Metricon Stadium"],
  ["Perth Stadium", "Optus Stadium"],
  ["Adelaide Oval"],
  ["Manuka Oval", "Corroboree Group Oval Manuka"],
  ["Blundstone Arena", "Bellerive Oval"],
  ["UTAS Stadium", "York Park", "University of Tasmania Stadium", "Aurora Stadium"],
  ["TIO Stadium", "Marrara Oval"],
  ["Traeger Park", "TIO Traeger Park"],
  ["Mars Stadium", "Eureka Stadium"],
  ["Cazalys Stadium", "Cazaly's Stadium"],
  ["Jiangwan Stadium"],
  ["Riverway Stadium"],
  ["Norwood Oval"],
  ["Subiaco Oval", "Subiaco"],
  ["Football Park", "AAMI Stadium"],
  ["Princes Park", "Ikon Park"],
  ["Blacktown International Sportspark"],
  ["Barossa Park", "Barossa Oval", "Adelaide Hills"],
  ["Ninja Stadium", "Summit Sports Park"],
];

/**
 * Pre-built lookup map from lowercased alias to canonical name.
 * Built once at module load time for O(1) lookups.
 */
const VENUE_ALIAS_MAP: ReadonlyMap<string, string> = (() => {
  const map = new Map<string, string>();
  for (const [canonical, ...aliases] of VENUE_ALIASES) {
    map.set(canonical.toLowerCase(), canonical);
    for (const alias of aliases) {
      map.set(alias.toLowerCase(), canonical);
    }
  }
  return map;
})();

/**
 * Normalise a venue name to its canonical form.
 *
 * Performs a case-insensitive lookup against all known venue names,
 * sponsor names, and historical names. Returns the input unchanged
 * if no mapping is found.
 *
 * @param raw - The raw venue name string from any data source.
 * @returns The canonical venue name, or the trimmed input if unknown.
 */
export function normaliseVenueName(raw: string): string {
  const trimmed = raw.trim();
  return VENUE_ALIAS_MAP.get(trimmed.toLowerCase()) ?? trimmed;
}
