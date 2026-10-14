/**
 * JSON output formatter — pretty-prints data via JSON.stringify.
 *
 * Dates are converted to ISO strings before serialisation so game
 * times are human-readable. Defaults to Australia/Melbourne, but
 * match rows with a non-null `venueTimezone` use the venue's IANA
 * tz so a Perth match shows AWST (#109).
 */

import { Cell, type CellValue, classifyCell, venueTimezoneOf } from "./cell";
import { toVenueIso } from "./date-format";

/**
 * Recursively convert Date instances to ISO strings before serialisation.
 *
 * The `venueTimezone` propagated from the enclosing object overrides
 * the default Melbourne tz for any Date deeper in the tree.
 */
function convertDates(value: CellValue, inheritedTz: string | undefined): CellValue {
  return Cell.$match(classifyCell(value), {
    Empty: () => value,
    Date: ({ date }) => toVenueIso(date, inheritedTz),
    Scalar: ({ scalar }) => scalar,
    List: ({ items }) => items.map((item) => convertDates(item, inheritedTz)),
    Record: ({ record }) => {
      const rowTz = venueTimezoneOf(record) ?? inheritedTz;

      return Object.fromEntries(
        Object.entries(record).map(([key, nested]) => [key, convertDates(nested, rowTz)]),
      );
    },
  });
}

/** Pretty-print a value as JSON, with dates as venue-local ISO strings. */
export function formatJson(data: CellValue): string {
  return JSON.stringify(convertDates(data, undefined), null, 2);
}
