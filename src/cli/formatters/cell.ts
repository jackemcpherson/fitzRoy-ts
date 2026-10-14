/**
 * The value contract shared by the output formatters.
 *
 * Every library result the CLI prints is a tree of plain records, arrays,
 * dates, and scalars. {@link CellValue} names that tree, so the formatters
 * accept domain types without widening them to `unknown`, and
 * {@link classifyCell} replaces ad-hoc `typeof` checks with one `Match`.
 */

import { Data, Match } from "effect";

/** A scalar that prints with `String(value)`. */
export type CellScalar = string | number | boolean;

/** Any value the formatters can print. */
export type CellValue = CellScalar | null | undefined | Date | readonly CellValue[] | CellRecord;

/** One output row or nested object: string keys over printable values. */
export type CellRecord = { readonly [key: string]: CellValue };

/** A {@link CellValue} split into the cases the formatters treat differently. */
export type Cell = Data.TaggedEnum<{
  /** `null` or `undefined`. */
  Empty: {};
  Date: { readonly date: Date };
  Scalar: { readonly scalar: CellScalar };
  List: { readonly items: readonly CellValue[] };
  Record: { readonly record: CellRecord };
}>;

/** Constructors and `$match` for {@link Cell}. */
export const Cell = Data.taggedEnum<Cell>();

const EMPTY = Cell.Empty();

/** Classify a printable value. Dates are matched before records. */
export function classifyCell(value: CellValue): Cell {
  return Match.value(value).pipe(
    Match.when(Match.date, (date) => Cell.Date({ date })),
    Match.whenOr(Match.string, Match.number, Match.boolean, (scalar) => Cell.Scalar({ scalar })),
    Match.when(Match.record, (record) => Cell.Record({ record })),
    Match.when(Match.defined, (items) => Cell.List({ items })),
    Match.orElse(() => EMPTY),
  );
}

/** The non-empty IANA timezone a row names in `venueTimezone`, if any. */
export function venueTimezoneOf(row: CellRecord | undefined): string | undefined {
  return Match.value(row?.["venueTimezone"]).pipe(
    Match.when(Match.nonEmptyString, (timezone) => timezone),
    Match.orElse(() => undefined),
  );
}
