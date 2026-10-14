/**
 * Effect schemas for the AFL API v2 REST surface.
 *
 * Covers the metadata endpoints (token, competitions, compseasons,
 * rounds, teams, squads, ladders) returned by `aflapi.afl.com.au/afl/v2`.
 * The match-level /cfs/ surface lives in `./afl-api-cfs`.
 *
 * Schemas use `open()` to tolerate extra fields the API may add
 * without breaking validation.
 */

import { Schema } from "effect";
import { open } from "./shared";

// ---------------------------------------------------------------------------
// Token response (WMCTok endpoint)
// ---------------------------------------------------------------------------

/** Schema for the AFL API WMCTok token response. */
export const AflApiTokenSchema = open({
  token: Schema.String,
  disclaimer: Schema.optional(Schema.String),
});

/** Inferred type for the AFL API token response. */
export type AflApiToken = typeof AflApiTokenSchema.Type;

// ---------------------------------------------------------------------------
// Competition list (/afl/v2/competitions)
// ---------------------------------------------------------------------------

/** Schema for a single competition entry. */
export const CompetitionSchema = open({
  id: Schema.Number,
  name: Schema.String,
  code: Schema.optional(Schema.String),
});

/** Schema for the competition list response. */
export const CompetitionListSchema = open({
  competitions: Schema.Array(CompetitionSchema),
});

/** Inferred type for a single competition. */
export type Competition = typeof CompetitionSchema.Type;

/** Inferred type for the competition list response. */
export type CompetitionList = typeof CompetitionListSchema.Type;

// ---------------------------------------------------------------------------
// Compseason list (/afl/v2/competitions/{compId}/compseasons)
// ---------------------------------------------------------------------------

/** Schema for a single compseason (competition-season) entry. */
export const CompseasonSchema = open({
  id: Schema.Number,
  name: Schema.String,
  shortName: Schema.optional(Schema.String),
  currentRoundNumber: Schema.optional(Schema.Number),
});

/** Schema for the compseason list response. */
export const CompseasonListSchema = open({
  compSeasons: Schema.Array(CompseasonSchema),
});

/** Inferred type for a single compseason. */
export type Compseason = typeof CompseasonSchema.Type;

/** Inferred type for the compseason list response. */
export type CompseasonList = typeof CompseasonListSchema.Type;

// ---------------------------------------------------------------------------
// Round list (/afl/v2/compseasons/{seasonId}/rounds)
// ---------------------------------------------------------------------------

/** Schema for a single round entry. */
export const RoundSchema = open({
  id: Schema.Number,
  /** Provider ID used by /cfs/ endpoints (e.g. "CD_R202501401"). */
  providerId: Schema.optional(Schema.String),
  name: Schema.String,
  abbreviation: Schema.optional(Schema.String),
  roundNumber: Schema.Number,
  utcStartTime: Schema.optional(Schema.String),
  utcEndTime: Schema.optional(Schema.String),
});

/** Schema for the round list response. */
export const RoundListSchema = open({
  rounds: Schema.Array(RoundSchema),
});

/** Inferred type for a single round. */
export type Round = typeof RoundSchema.Type;

/** Inferred type for the round list response. */
export type RoundList = typeof RoundListSchema.Type;

// ---------------------------------------------------------------------------
// Team list (/afl/v2/teams)
// ---------------------------------------------------------------------------

/** Schema for a single team entry. */
export const TeamItemSchema = open({
  id: Schema.Number,
  name: Schema.String,
  abbreviation: Schema.optional(Schema.String),
  teamType: Schema.optional(Schema.String),
});

/** Schema for the team list response. */
export const TeamListSchema = open({
  teams: Schema.Array(TeamItemSchema),
});

/** Inferred type for a single team item. */
export type TeamItem = typeof TeamItemSchema.Type;

/** Inferred type for the team list response. */
export type TeamList = typeof TeamListSchema.Type;

// ---------------------------------------------------------------------------
// Squad (/afl/v2/squads?teamId={}&compSeasonId={})
// ---------------------------------------------------------------------------

/** Schema for a player's inner identity within a squad. */
export const SquadPlayerInnerSchema = open({
  id: Schema.Number,
  providerId: Schema.optional(Schema.String),
  firstName: Schema.String,
  surname: Schema.String,
  dateOfBirth: Schema.optional(Schema.String),
  heightInCm: Schema.optional(Schema.Number),
  weightInKg: Schema.optional(Schema.Number),
  draftYear: Schema.optional(Schema.String),
  draftPosition: Schema.optional(Schema.String),
  draftType: Schema.optional(Schema.String),
  debutYear: Schema.optional(Schema.String),
  recruitedFrom: Schema.optional(Schema.String),
});

/** Schema for a single squad player entry. */
export const SquadPlayerItemSchema = open({
  player: SquadPlayerInnerSchema,
  jumperNumber: Schema.optional(Schema.NullOr(Schema.Number)),
  position: Schema.optional(Schema.String),
});

/** Schema for the squad wrapper object. */
export const SquadSchema = open({
  team: Schema.optional(
    open({
      name: Schema.String,
    }),
  ),
  players: Schema.Array(SquadPlayerItemSchema),
});

/** Schema for the squad response. */
export const SquadListSchema = open({
  squad: SquadSchema,
});

/** Inferred type for a single squad player item. */
export type SquadPlayerItem = typeof SquadPlayerItemSchema.Type;

/** Inferred type for the squad response. */
export type SquadList = typeof SquadListSchema.Type;

// ---------------------------------------------------------------------------
// Ladder (/afl/v2/compseasons/{seasonId}/ladders)
// ---------------------------------------------------------------------------

/** Schema for a win/loss/draw record. */
const WinLossRecordSchema = open({
  wins: Schema.Number,
  losses: Schema.Number,
  draws: Schema.Number,
  played: Schema.optional(Schema.Number),
});

/** Schema for a single ladder entry from the AFL API. */
export const LadderEntryRawSchema = open({
  position: Schema.Number,
  team: open({
    name: Schema.String,
    id: Schema.optional(Schema.Number),
    abbreviation: Schema.optional(Schema.String),
  }),
  played: Schema.optional(Schema.Number),
  pointsFor: Schema.optional(Schema.Number),
  pointsAgainst: Schema.optional(Schema.Number),
  thisSeasonRecord: Schema.optional(
    open({
      aggregatePoints: Schema.optional(Schema.Number),
      percentage: Schema.optional(Schema.Number),
      winLossRecord: Schema.optional(WinLossRecordSchema),
    }),
  ),
  form: Schema.optional(Schema.String),
});

/** Schema for the ladder API response. */
export const LadderResponseSchema = open({
  ladders: Schema.Array(open({ entries: Schema.Array(LadderEntryRawSchema) })),
  round: Schema.optional(
    open({
      roundNumber: Schema.Number,
      name: Schema.optional(Schema.String),
    }),
  ),
});

/** Inferred type for a raw ladder entry. */
export type LadderEntryRaw = typeof LadderEntryRawSchema.Type;

/** Inferred type for the ladder API response. */
export type LadderResponse = typeof LadderResponseSchema.Type;
