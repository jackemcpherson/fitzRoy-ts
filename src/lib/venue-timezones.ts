/**
 * Static venue → IANA timezone map.
 *
 * Keyed by *canonical* venue name (run input through
 * {@link normaliseVenueName} first). Used by scraped sources (FootyWire,
 * AFL Tables) where the upstream payload doesn't carry a tz; the AFL API
 * already provides `venue.timezone` per match and doesn't need this map.
 */

const VENUE_TIMEZONES: ReadonlyMap<string, string> = new Map([
  // Victoria — Australia/Melbourne (AEST/AEDT)
  ["MCG", "Australia/Melbourne"],
  ["Marvel Stadium", "Australia/Melbourne"],
  ["Kardinia Park", "Australia/Melbourne"],
  ["Mars Stadium", "Australia/Melbourne"],
  ["Princes Park", "Australia/Melbourne"],
  ["Eureka Stadium", "Australia/Melbourne"],
  // New South Wales / ACT — Australia/Sydney (AEST/AEDT)
  ["SCG", "Australia/Sydney"],
  ["Sydney Showground", "Australia/Sydney"],
  ["Accor Stadium", "Australia/Sydney"],
  ["Manuka Oval", "Australia/Sydney"],
  ["Blacktown International Sportspark", "Australia/Sydney"],
  // Queensland — Australia/Brisbane (AEST, no DST)
  ["Gabba", "Australia/Brisbane"],
  ["Carrara", "Australia/Brisbane"],
  ["Riverway Stadium", "Australia/Brisbane"],
  ["Cazalys Stadium", "Australia/Brisbane"],
  // South Australia — Australia/Adelaide (ACST/ACDT)
  ["Adelaide Oval", "Australia/Adelaide"],
  ["Norwood Oval", "Australia/Adelaide"],
  ["Football Park", "Australia/Adelaide"],
  ["Barossa Park", "Australia/Adelaide"],
  // Tasmania — Australia/Hobart (AEST/AEDT)
  ["Blundstone Arena", "Australia/Hobart"],
  ["UTAS Stadium", "Australia/Hobart"],
  ["Ninja Stadium", "Australia/Hobart"],
  // Western Australia — Australia/Perth (AWST, no DST)
  ["Perth Stadium", "Australia/Perth"],
  ["Subiaco Oval", "Australia/Perth"],
  // Northern Territory — Australia/Darwin (ACST, no DST)
  ["TIO Stadium", "Australia/Darwin"],
  ["Traeger Park", "Australia/Darwin"],
  // International
  ["Jiangwan Stadium", "Asia/Shanghai"],
]);

/**
 * Resolve a canonical venue name to its IANA timezone.
 *
 * Returns `null` when the venue is unknown so callers can decide a fallback
 * (e.g. Melbourne) explicitly rather than receiving a silently-wrong value.
 *
 * @param canonicalVenue - A canonical venue name (run through
 * {@link normaliseVenueName} beforehand).
 */
export function resolveVenueTimezone(canonicalVenue: string): string | null {
  return VENUE_TIMEZONES.get(canonicalVenue) ?? null;
}
