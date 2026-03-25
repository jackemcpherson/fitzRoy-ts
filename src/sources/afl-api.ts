/**
 * AFL API client with token authentication and typed fetch helpers.
 *
 * The client handles WMCTok token authentication, automatic 401 retry
 * with re-authentication, and Zod-validated JSON responses.
 *
 * Accepts an injectable `fetch` function for testability.
 */

import type { z } from "zod/v4";
import { AflApiError, ValidationError } from "../lib/errors";
import { err, ok, type Result } from "../lib/result";
import {
  AflApiTokenSchema,
  CompetitionListSchema,
  CompseasonListSchema,
  type Round,
  RoundListSchema,
} from "../lib/validation";
import type { CompetitionCode } from "../types";

/** WMCTok token endpoint used by the AFL website. */
const TOKEN_URL = "https://api.afl.com.au/cfs/afl/WMCTok";

/** Base URL for AFL API v2 endpoints. */
const API_BASE = "https://api.afl.com.au/afl/v2";

/** Cached token with expiry tracking. */
interface CachedToken {
  readonly accessToken: string;
  readonly expiresAt: number;
}

/** Options for constructing an {@link AflApiClient}. */
export interface AflApiClientOptions {
  /** Custom fetch implementation (defaults to global `fetch`). */
  readonly fetchFn?: typeof fetch | undefined;
  /** Token endpoint override (useful for testing). */
  readonly tokenUrl?: string | undefined;
}

/**
 * AFL API client that handles token authentication and provides typed fetch helpers.
 *
 * @example
 * ```ts
 * const client = new AflApiClient();
 * await client.authenticate();
 * const result = await client.fetchJson("https://api.afl.com.au/cfs/afl/matchItems/round/123", MatchItemListSchema);
 * ```
 */
export class AflApiClient {
  private readonly fetchFn: typeof fetch;
  private readonly tokenUrl: string;
  private cachedToken: CachedToken | null = null;

  constructor(options?: AflApiClientOptions) {
    this.fetchFn = options?.fetchFn ?? globalThis.fetch;
    this.tokenUrl = options?.tokenUrl ?? TOKEN_URL;
  }

  /**
   * Authenticate with the WMCTok token endpoint and cache the token.
   *
   * @returns The access token on success, or an error Result.
   */
  async authenticate(): Promise<Result<string, AflApiError>> {
    try {
      const response = await this.fetchFn(this.tokenUrl, { method: "POST" });

      if (!response.ok) {
        return err(new AflApiError(`Token request failed: ${response.status}`, response.status));
      }

      const json: unknown = await response.json();
      const parsed = AflApiTokenSchema.safeParse(json);

      if (!parsed.success) {
        return err(new AflApiError("Invalid token response format"));
      }

      const bufferMs = 60_000;
      this.cachedToken = {
        accessToken: parsed.data.access_token,
        expiresAt: Date.now() + parsed.data.expires_in * 1000 - bufferMs,
      };

      return ok(parsed.data.access_token);
    } catch (cause) {
      return err(
        new AflApiError(
          `Token request failed: ${cause instanceof Error ? cause.message : String(cause)}`,
        ),
      );
    }
  }

  /**
   * Whether the cached token is still valid (not expired).
   */
  get isAuthenticated(): boolean {
    return this.cachedToken !== null && Date.now() < this.cachedToken.expiresAt;
  }

  /**
   * Perform an authenticated fetch, automatically adding the bearer token.
   * Retries once on 401 by re-authenticating.
   *
   * @param url - The URL to fetch.
   * @param init - Additional fetch options.
   * @returns The Response on success, or an error Result.
   */
  async authedFetch(url: string, init?: RequestInit): Promise<Result<Response, AflApiError>> {
    if (!this.isAuthenticated) {
      const authResult = await this.authenticate();
      if (!authResult.success) {
        return authResult;
      }
    }

    const doFetch = async (): Promise<Response> => {
      const token = this.cachedToken;
      if (!token) {
        throw new AflApiError("No cached token available");
      }
      const headers = new Headers(init?.headers);
      headers.set("Authorization", `Bearer ${token.accessToken}`);
      return this.fetchFn(url, { ...init, headers });
    };

    try {
      let response = await doFetch();

      if (response.status === 401) {
        const authResult = await this.authenticate();
        if (!authResult.success) {
          return authResult;
        }
        response = await doFetch();
      }

      if (!response.ok) {
        return err(
          new AflApiError(
            `Request failed: ${response.status} ${response.statusText}`,
            response.status,
          ),
        );
      }

      return ok(response);
    } catch (cause) {
      return err(
        new AflApiError(
          `Request failed: ${cause instanceof Error ? cause.message : String(cause)}`,
        ),
      );
    }
  }

  /**
   * Fetch JSON from a URL, validate with a Zod schema, and return a typed Result.
   *
   * @param url - The URL to fetch.
   * @param schema - Zod schema to validate the response against.
   * @returns Validated data on success, or an error Result.
   */
  async fetchJson<T>(
    url: string,
    schema: z.ZodType<T>,
  ): Promise<Result<T, AflApiError | ValidationError>> {
    const fetchResult = await this.authedFetch(url);

    if (!fetchResult.success) {
      return fetchResult;
    }

    try {
      const json: unknown = await fetchResult.data.json();
      const parsed = schema.safeParse(json);

      if (!parsed.success) {
        return err(
          new ValidationError("Response validation failed", [
            { path: url, message: String(parsed.error) },
          ]),
        );
      }

      return ok(parsed.data);
    } catch (cause) {
      return err(
        new AflApiError(
          `JSON parse failed: ${cause instanceof Error ? cause.message : String(cause)}`,
        ),
      );
    }
  }

  /**
   * Resolve a competition code (e.g. "AFLM") to its API competition ID.
   *
   * @param code - The competition code to resolve.
   * @returns The competition ID string on success.
   */
  async resolveCompetitionId(
    code: CompetitionCode,
  ): Promise<Result<string, AflApiError | ValidationError>> {
    const result = await this.fetchJson(`${API_BASE}/competitions`, CompetitionListSchema);

    if (!result.success) {
      return result;
    }

    const competition = result.data.competitions.find((c) => c.code === code);

    if (!competition) {
      return err(new AflApiError(`Competition not found for code: ${code}`));
    }

    return ok(competition.id);
  }

  /**
   * Resolve a season (compseason) ID from a competition ID and year.
   *
   * @param competitionId - The competition ID (from {@link resolveCompetitionId}).
   * @param year - The season year (e.g. 2024).
   * @returns The compseason ID string on success.
   */
  async resolveSeasonId(
    competitionId: string,
    year: number,
  ): Promise<Result<string, AflApiError | ValidationError>> {
    const result = await this.fetchJson(
      `${API_BASE}/competitions/${competitionId}/compseasons`,
      CompseasonListSchema,
    );

    if (!result.success) {
      return result;
    }

    const yearStr = String(year);
    const season = result.data.compseasons.find(
      (cs) => cs.name.includes(yearStr) || cs.year === yearStr,
    );

    if (!season) {
      return err(new AflApiError(`Season not found for year: ${year}`));
    }

    return ok(season.id);
  }

  /**
   * Fetch all rounds for a season with their metadata.
   *
   * @param seasonId - The compseason ID (from {@link resolveSeasonId}).
   * @returns Array of round objects on success.
   */
  async resolveRounds(seasonId: string): Promise<Result<Round[], AflApiError | ValidationError>> {
    const result = await this.fetchJson(
      `${API_BASE}/compseasons/${seasonId}/rounds`,
      RoundListSchema,
    );

    if (!result.success) {
      return result;
    }

    return ok(result.data.rounds);
  }

  /**
   * Resolve a specific round ID from a season ID and round number.
   *
   * @param seasonId - The compseason ID (from {@link resolveSeasonId}).
   * @param roundNumber - The round number to find.
   * @returns The round ID string on success.
   */
  async resolveRoundId(
    seasonId: string,
    roundNumber: number,
  ): Promise<Result<string, AflApiError | ValidationError>> {
    const roundsResult = await this.resolveRounds(seasonId);

    if (!roundsResult.success) {
      return roundsResult;
    }

    const round = roundsResult.data.find((r) => r.roundNumber === roundNumber);

    if (!round) {
      return err(new AflApiError(`Round not found: round ${roundNumber}`));
    }

    return ok(round.id);
  }
}
