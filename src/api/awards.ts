/**
 * Public API for fetching AFL awards data from FootyWire.
 */

import { ScrapeError } from "../lib/errors";
import { err, ok, type Result } from "../lib/result";
import { FootyWireClient } from "../sources/footywire";
import {
  parseAllAustralian,
  parseBrownlowVotes,
  parseRisingStarNominations,
} from "../transforms/awards";
import type { Award, AwardQuery } from "../types";

const FOOTYWIRE_BASE = "https://www.footywire.com/afl/footy";

/**
 * Fetch awards data from FootyWire.
 *
 * @param query - Award type and season.
 * @returns Array of award entries (discriminated union by `type` field).
 *
 * @example
 * ```ts
 * const result = await fetchAwards({ award: "brownlow", season: 2023 });
 * ```
 */
export async function fetchAwards(query: AwardQuery): Promise<Result<Award[], Error>> {
  const client = new FootyWireClient();

  switch (query.award) {
    case "brownlow": {
      const url = `${FOOTYWIRE_BASE}/brownlow_medal?year=${query.season}`;
      const htmlResult = await client.fetchPage(url);
      if (!htmlResult.success) return htmlResult;

      const votes = parseBrownlowVotes(htmlResult.data, query.season);
      if (votes.length === 0) {
        return err(
          new ScrapeError(`No Brownlow data found for season ${query.season}`, "footywire"),
        );
      }
      return ok(votes);
    }

    case "all-australian": {
      const url = `${FOOTYWIRE_BASE}/all_australian_selection?year=${query.season}`;
      const htmlResult = await client.fetchPage(url);
      if (!htmlResult.success) return htmlResult;

      const selections = parseAllAustralian(htmlResult.data, query.season);
      if (selections.length === 0) {
        return err(
          new ScrapeError(`No All-Australian data found for season ${query.season}`, "footywire"),
        );
      }
      return ok(selections);
    }

    case "rising-star": {
      const url = `${FOOTYWIRE_BASE}/rising_star_nominations?year=${query.season}`;
      const htmlResult = await client.fetchPage(url);
      if (!htmlResult.success) return htmlResult;

      const nominations = parseRisingStarNominations(htmlResult.data, query.season);
      if (nominations.length === 0) {
        return err(
          new ScrapeError(`No Rising Star data found for season ${query.season}`, "footywire"),
        );
      }
      return ok(nominations);
    }

    default:
      return err(new ScrapeError(`Unknown award type: ${query.award}`, "footywire"));
  }
}
