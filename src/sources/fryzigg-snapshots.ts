import type { CompetitionCode } from "../types";

/** Integrity and coverage metadata for one reviewed Fryzigg snapshot. */
export interface FryziggSnapshot {
  readonly url: string;
  readonly sha256: string;
  readonly byteLength: number;
  readonly minSeason: number;
  readonly maxSeason: number;
  readonly upstreamLastModified: string;
  readonly verifiedAt: string;
}

/**
 * Reviewed Fryzigg snapshots used by the default client and adapter.
 *
 * The upstream host is HTTP-only, so these digests are trust-on-first-use:
 * an operator reviewed two byte-identical downloads on 2026-07-11, but the
 * initial bytes were not authenticated in transit. To update a snapshot:
 *
 * 1. Download it twice and compare SHA-256 digests and byte lengths.
 * 2. Parse it, inspect the expected schema, and confirm the maximum season.
 * 3. Obtain human review of the new digest.
 * 4. Update URL, digest, byte length, coverage, and metadata atomically here.
 * 5. Run the focused tests and the complete verification suite.
 */
export const FRYZIGG_SNAPSHOTS = {
  AFLM: {
    url: "http://www.fryziggafl.net/static/fryziggafl.rds",
    sha256: "67660083912875a48bf3e0d8af73916fbd2475edbbfc94249389156e563c5bc4",
    byteLength: 12_117_839,
    minSeason: 2012,
    maxSeason: 2025,
    upstreamLastModified: "Mon, 29 Sep 2025 07:06:21 GMT",
    verifiedAt: "2026-07-11",
  },
  AFLW: {
    url: "http://www.fryziggafl.net/static/aflw_player_stats.rds",
    sha256: "a8a0cf953d1eb30afbab31b1efea447d9119aa4c35ff7cb69b1af595a1784e73",
    byteLength: 310_458,
    minSeason: 2017,
    maxSeason: 2022,
    upstreamLastModified: "Mon, 24 Jan 2022 14:57:15 GMT",
    verifiedAt: "2026-07-11",
  },
} as const satisfies Partial<Record<CompetitionCode, FryziggSnapshot>>;

export type FryziggCompetition = keyof typeof FRYZIGG_SNAPSHOTS;
