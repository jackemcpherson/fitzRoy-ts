/**
 * Shared domain types for fitzRoy-ts.
 *
 * Define all domain types here before writing implementation code.
 * Types are the single source of truth for the data model.
 *
 * Each domain model is an Effect Schema constant (`FooSchema`) and its
 * TypeScript type is derived from it (`type Foo = typeof FooSchema.Type`).
 */

import { Schema } from "effect";

// ---------------------------------------------------------------------------
// Enums-as-unions
// ---------------------------------------------------------------------------

/** AFL competition codes. */
export const CompetitionCodeSchema = Schema.Literals(["AFLM", "AFLW", "VFL", "VFLW"]);

/** AFL competition codes. */
export type CompetitionCode = typeof CompetitionCodeSchema.Type;

/** Round classification. */
export const RoundTypeSchema = Schema.Literals(["HomeAndAway", "Finals"]);

/** Round classification. */
export type RoundType = typeof RoundTypeSchema.Type;

/** Supported data sources mirroring the R package's `source` parameter. */
export const DataSourceSchema = Schema.Literals([
  "afl-api",
  "footywire",
  "afl-tables",
  "squiggle",
  "fryzigg",
  "afl-coaches",
]);

/** Supported data sources mirroring the R package's `source` parameter. */
export type DataSource = typeof DataSourceSchema.Type;

/** Match status as reported by the AFL API. */
export const MatchStatusSchema = Schema.Literals([
  "Upcoming",
  "Live",
  "Complete",
  "Postponed",
  "Cancelled",
]);

/** Match status as reported by the AFL API. */
export type MatchStatus = typeof MatchStatusSchema.Type;

// ---------------------------------------------------------------------------
// Season selector
// ---------------------------------------------------------------------------

/**
 * Canonical season key or an unambiguous numeric calendar year.
 *
 * Kept as a plain TypeScript type because it contains a template-literal
 * member (`${number}`); {@link SeasonSelectorSchema} mirrors it exactly for
 * use inside the query schemas.
 */
export type SeasonSelector = number | `${number}` | "2022-S6" | "2022-S7";

/** Schema mirroring {@link SeasonSelector} (its `Type` is identical). */
export const SeasonSelectorSchema = Schema.Union([
  Schema.Number,
  Schema.TemplateLiteral([Schema.Number]),
  Schema.Literals(["2022-S6", "2022-S7"]),
]);

// ---------------------------------------------------------------------------
// Match coaches
// ---------------------------------------------------------------------------

/** Query for source-grounded credited match coaches. */
export const MatchCoachesQuerySchema = Schema.Struct({
  season: Schema.Number,
  source: Schema.optionalKey(DataSourceSchema),
  competition: Schema.optionalKey(CompetitionCodeSchema),
  team: Schema.optionalKey(Schema.String),
  /** Optional bounded AFL Tables profile batch. Cursors are opaque and season-specific. */
  batch: Schema.optionalKey(
    Schema.Struct({
      limit: Schema.optionalKey(Schema.Number),
      cursor: Schema.optionalKey(Schema.String),
    }),
  ),
});

/** Query for source-grounded credited match coaches. */
export type MatchCoachesQuery = typeof MatchCoachesQuerySchema.Type;

/** A coach credited to one club in one source-identified match. */
export const MatchCoachAssignmentSchema = Schema.Struct({
  competition: CompetitionCodeSchema,
  season: Schema.Number,
  team: Schema.String,
  /** Provider-qualified coach profile key. Treat as opaque. */
  coachId: Schema.String,
  coachName: Schema.String,
  coachUrl: Schema.String,
  /** Provider-qualified match key. Treat as opaque. */
  matchId: Schema.String,
  matchUrl: Schema.String,
  date: Schema.NullOr(Schema.String),
  /** Participant/score pairs in provider order; reconcile both orientations. */
  homeTeam: Schema.NullOr(Schema.String),
  awayTeam: Schema.NullOr(Schema.String),
  homePoints: Schema.NullOr(Schema.Number),
  awayPoints: Schema.NullOr(Schema.Number),
  roundName: Schema.NullOr(Schema.String),
  source: Schema.Literals(["afl-tables", "footywire"]),
});

/** A coach credited to one club in one source-identified match. */
export type MatchCoachAssignment = typeof MatchCoachAssignmentSchema.Type;

/** One failed page or match scope during a coaching scrape. */
export const MatchCoachFailureSchema = Schema.Struct({
  url: Schema.String,
  reason: Schema.String,
  scope: Schema.String,
  matchId: Schema.optionalKey(Schema.String),
  /** Provider-qualified failed coach profile identity, when known. */
  coachId: Schema.optionalKey(Schema.String),
});

/** One failed page or match scope during a coaching scrape. */
export type MatchCoachFailure = typeof MatchCoachFailureSchema.Type;

/** Successful rows plus explicit completeness information. */
export const MatchCoachesResultSchema = Schema.Struct({
  /** Page-batch success never establishes season-wide completeness. */
  batch: Schema.optionalKey(
    Schema.Struct({
      scope: Schema.Literal("pages"),
      nextCursor: Schema.NullOr(Schema.String),
      completedCoachIds: Schema.Array(Schema.String),
    }),
  ),
  /** Mutable array (callers build it incrementally). */
  assignments: Schema.mutable(Schema.Array(MatchCoachAssignmentSchema)),
  completeness: Schema.Struct({
    complete: Schema.Boolean,
    /** Mutable array (callers build it incrementally). */
    failures: Schema.mutable(Schema.Array(MatchCoachFailureSchema)),
  }),
});

/** Successful rows plus explicit completeness information. */
export type MatchCoachesResult = typeof MatchCoachesResultSchema.Type;

// ---------------------------------------------------------------------------
// Score types
// ---------------------------------------------------------------------------

/** Goals-behinds-points breakdown for a single quarter. */
export const QuarterScoreSchema = Schema.Struct({
  goals: Schema.Number,
  behinds: Schema.Number,
  points: Schema.Number,
});

/** Goals-behinds-points breakdown for a single quarter. */
export type QuarterScore = typeof QuarterScoreSchema.Type;

/**
 * One quarter's entry in the AFL API's `score.matchClock.periods[]` (#145).
 *
 * `periodCompleted` flips to `true` within seconds of the actual siren and
 * is the authoritative signal for quarter boundaries — see
 * {@link Match.matchClockPeriods}.
 */
export const MatchClockPeriodSchema = Schema.Struct({
  periodNumber: Schema.Number,
  periodSeconds: Schema.NullOr(Schema.Number),
  periodCompleted: Schema.Boolean,
  /** ISO 8601 UTC start of the period, when known. */
  periodStart: Schema.NullOr(Schema.String),
  /** ISO 8601 UTC scheduled start of the next period, when known. */
  nextPeriodStart: Schema.NullOr(Schema.String),
});

/** One quarter's entry in the AFL API's match clock (#145). */
export type MatchClockPeriod = typeof MatchClockPeriodSchema.Type;

// ---------------------------------------------------------------------------
// Match
// ---------------------------------------------------------------------------

/**
 * An AFL match in any state — scheduled, in-progress, or completed.
 *
 * One row per match. A "fixture" is a Match with `status="Upcoming"` and
 * null score fields; a completed match has the score fields populated.
 * Quarter scores are nullable — historical data from AFL Tables may not
 * include them.
 */
export const MatchSchema = Schema.Struct({
  /** Provider-assigned match identifier (e.g. AFL API `matchProviderId`). */
  matchId: Schema.String,
  season: Schema.Number,
  /** Canonical competition-season identity, populated by public fetch APIs. */
  seasonKey: Schema.optionalKey(Schema.String),
  roundNumber: Schema.Number,
  roundType: RoundTypeSchema,
  /**
   * Human-readable round name (e.g. "Round 1", "Qualifying Final"). Populated
   * by AFL API, AFL Tables, and FootyWire; null only for sources that don't
   * expose round labels (e.g. Squiggle).
   */
  roundName: Schema.NullOr(Schema.String),
  date: Schema.Date,
  venue: Schema.String,
  homeTeam: Schema.String,
  awayTeam: Schema.String,

  /**
   * Total goals-behinds-points for each team. Null when the match has not
   * yet been played (status="Upcoming").
   *
   * FootyWire match-list rows (`source: "footywire"`) always carry null
   * goals/behinds — the match-list page only publishes total points, so
   * only `homePoints`/`awayPoints` are populated for that source. Use the
   * per-match stats pages (or another source) when you need the
   * goals-behinds breakdown.
   */
  homeGoals: Schema.NullOr(Schema.Number),
  homeBehinds: Schema.NullOr(Schema.Number),
  homePoints: Schema.NullOr(Schema.Number),
  awayGoals: Schema.NullOr(Schema.Number),
  awayBehinds: Schema.NullOr(Schema.Number),
  awayPoints: Schema.NullOr(Schema.Number),

  /** Positive = home win, negative = away win. Null for upcoming matches. */
  margin: Schema.NullOr(Schema.Number),

  /** Per-quarter scores (null when unavailable). */
  q1Home: Schema.NullOr(QuarterScoreSchema),
  q2Home: Schema.NullOr(QuarterScoreSchema),
  q3Home: Schema.NullOr(QuarterScoreSchema),
  q4Home: Schema.NullOr(QuarterScoreSchema),
  q1Away: Schema.NullOr(QuarterScoreSchema),
  q2Away: Schema.NullOr(QuarterScoreSchema),
  q3Away: Schema.NullOr(QuarterScoreSchema),
  q4Away: Schema.NullOr(QuarterScoreSchema),

  status: MatchStatusSchema,

  /**
   * Raw period-level status from the AFL API's score wrapper (`CfsScore.status`),
   * surfaced for live-match consumers that need to detect siren transitions
   * (e.g. quarter time, half time, full time). Null for any source that doesn't
   * expose a per-period state — currently every source except `afl-api` — and
   * null on `afl-api` rows when the score wrapper itself is absent (pre-match).
   *
   * **Unreliable for break detection in 2026+ (#145).** Through R14 2026 the
   * AFL API has stopped transitioning this string through `QTR_TIME` /
   * `HALF_TIME` / `3QTR_TIME` — it stays on `LIVE` from bounce through the
   * final siren, with only `FULL_TIME` / `CONCLUDED` flipping after. For
   * authoritative break detection use {@link Match.matchClockPeriods} or
   * {@link Match.completedQuarter} instead.
   *
   * The string values are upstream-defined and not yet enumerated; observed
   * values to date come straight from the AFL API and may include codes such
   * as `LIVE`, `QTR_TIME`, `HALF_TIME`, `3QTR_TIME`, `FULL_TIME`. Treat as an
   * opaque string until a stable union is documented.
   */
  livePeriodStatus: Schema.NullOr(Schema.String),

  /**
   * AFL API match-clock periods (#145). Each entry corresponds to one
   * quarter and carries a `periodCompleted` flag that flips within seconds
   * of each siren — making this the authoritative break-detection signal,
   * unlike {@link Match.livePeriodStatus} which 2026 upstream changes left
   * stuck on `LIVE` through breaks.
   *
   * Null for any source other than `afl-api`, and null on `afl-api` rows
   * when the score wrapper is absent (pre-match).
   */
  matchClockPeriods: Schema.NullOr(Schema.Array(MatchClockPeriodSchema)),

  /**
   * Highest fully-completed quarter according to the AFL match clock (#145).
   * `0` means no quarter has finished (live first quarter or pre-match);
   * `4` means full time. Derived from {@link Match.matchClockPeriods}.
   * Null when the underlying matchClock is unavailable.
   */
  completedQuarter: Schema.NullOr(Schema.Literals([0, 1, 2, 3, 4])),

  attendance: Schema.NullOr(Schema.Number),

  /** Weather conditions at the venue (null when unavailable). */
  weatherTempCelsius: Schema.NullOr(Schema.Number),
  weatherType: Schema.NullOr(Schema.String),

  /**
   * Normalised round code (e.g. "R1", "QF", "GF"). Populated by AFL API, AFL
   * Tables, and FootyWire; null only for sources that don't expose round
   * labels (e.g. Squiggle).
   */
  roundCode: Schema.NullOr(Schema.String),

  /** Venue metadata (null for scraped sources). */
  venueState: Schema.NullOr(Schema.String),

  /**
   * IANA timezone for the venue (e.g. `"Australia/Melbourne"`,
   * `"Australia/Perth"`). Normalised across sources (#109): the AFL
   * API publishes IANA directly; other sources resolve via the
   * canonical venue → IANA map ({@link resolveVenueTimezone}). `null`
   * only when the venue isn't in the map (very old or one-off venues).
   */
  venueTimezone: Schema.NullOr(Schema.String),

  /**
   * Venue wall-clock start time (#109). The AFL API publishes this as a
   * timezone-less ISO string (`"2025-03-13T19:30:00"`); other sources
   * derive it from {@link Match.date} interpreted in
   * {@link Match.venueTimezone}. Useful for "7:30pm at the venue"
   * displays without doing your own UTC→tz conversion. `null` when
   * neither the upstream localStartTime nor a venue tz is known.
   */
  venueLocalDate: Schema.NullOr(Schema.String),

  /** Rushed behinds per team (null when unavailable). */
  homeRushedBehinds: Schema.NullOr(Schema.Number),
  awayRushedBehinds: Schema.NullOr(Schema.Number),

  /** Minutes each team spent in front (null when unavailable). */
  homeMinutesInFront: Schema.NullOr(Schema.Number),
  awayMinutesInFront: Schema.NullOr(Schema.Number),

  source: DataSourceSchema,
  competition: CompetitionCodeSchema,
});

/** An AFL match in any state — scheduled, in-progress, or completed. */
export type Match = typeof MatchSchema.Type;

// ---------------------------------------------------------------------------
// Player statistics
// ---------------------------------------------------------------------------

/**
 * Per-player statistics for a single match.
 *
 * Fields are nullable because not all stats are available for every
 * era or source.
 */
export const PlayerStatsSchema = Schema.Struct({
  matchId: Schema.String,
  season: Schema.Number,
  /** Canonical competition-season identity, populated by public fetch APIs. */
  seasonKey: Schema.optionalKey(Schema.String),
  roundNumber: Schema.Number,
  team: Schema.String,
  competition: CompetitionCodeSchema,

  /** Match context for cross-source joins (null when unavailable). */
  date: Schema.NullOr(Schema.Date),
  homeTeam: Schema.NullOr(Schema.String),
  awayTeam: Schema.NullOr(Schema.String),

  /** Player identification. */
  playerId: Schema.String,
  givenName: Schema.String,
  surname: Schema.String,
  displayName: Schema.String,
  jumperNumber: Schema.NullOr(Schema.Number),

  /** Core stats. */
  kicks: Schema.NullOr(Schema.Number),
  handballs: Schema.NullOr(Schema.Number),
  disposals: Schema.NullOr(Schema.Number),
  marks: Schema.NullOr(Schema.Number),
  goals: Schema.NullOr(Schema.Number),
  behinds: Schema.NullOr(Schema.Number),
  tackles: Schema.NullOr(Schema.Number),
  hitouts: Schema.NullOr(Schema.Number),
  freesFor: Schema.NullOr(Schema.Number),
  freesAgainst: Schema.NullOr(Schema.Number),

  /** Contested/uncontested. */
  contestedPossessions: Schema.NullOr(Schema.Number),
  uncontestedPossessions: Schema.NullOr(Schema.Number),
  contestedMarks: Schema.NullOr(Schema.Number),
  intercepts: Schema.NullOr(Schema.Number),

  /** Clearances. */
  centreClearances: Schema.NullOr(Schema.Number),
  stoppageClearances: Schema.NullOr(Schema.Number),
  totalClearances: Schema.NullOr(Schema.Number),

  /** Other stats. */
  inside50s: Schema.NullOr(Schema.Number),
  rebound50s: Schema.NullOr(Schema.Number),
  clangers: Schema.NullOr(Schema.Number),
  turnovers: Schema.NullOr(Schema.Number),
  onePercenters: Schema.NullOr(Schema.Number),
  bounces: Schema.NullOr(Schema.Number),
  goalAssists: Schema.NullOr(Schema.Number),
  disposalEfficiency: Schema.NullOr(Schema.Number),
  metresGained: Schema.NullOr(Schema.Number),

  /** Additional base stats. */
  goalAccuracy: Schema.NullOr(Schema.Number),
  marksInside50: Schema.NullOr(Schema.Number),
  tacklesInside50: Schema.NullOr(Schema.Number),
  shotsAtGoal: Schema.NullOr(Schema.Number),
  scoreInvolvements: Schema.NullOr(Schema.Number),
  totalPossessions: Schema.NullOr(Schema.Number),
  timeOnGroundPercentage: Schema.NullOr(Schema.Number),
  ratingPoints: Schema.NullOr(Schema.Number),

  /** Position played in this match (e.g. "INT", "MIDFIELD"). Null when unavailable. */
  position: Schema.NullOr(Schema.String),

  /** Efficiency stats. */
  goalEfficiency: Schema.NullOr(Schema.Number),
  shotEfficiency: Schema.NullOr(Schema.Number),
  interchangeCounts: Schema.NullOr(Schema.Number),

  /** Brownlow votes received in this match (null when unavailable). */
  brownlowVotes: Schema.NullOr(Schema.Number),

  /** Fantasy. */
  supercoachScore: Schema.NullOr(Schema.Number),
  dreamTeamPoints: Schema.NullOr(Schema.Number),

  /** Extended stats. */
  effectiveDisposals: Schema.NullOr(Schema.Number),
  effectiveKicks: Schema.NullOr(Schema.Number),
  kickEfficiency: Schema.NullOr(Schema.Number),
  kickToHandballRatio: Schema.NullOr(Schema.Number),
  pressureActs: Schema.NullOr(Schema.Number),
  defHalfPressureActs: Schema.NullOr(Schema.Number),
  spoils: Schema.NullOr(Schema.Number),
  hitoutsToAdvantage: Schema.NullOr(Schema.Number),
  hitoutWinPercentage: Schema.NullOr(Schema.Number),
  hitoutToAdvantageRate: Schema.NullOr(Schema.Number),
  groundBallGets: Schema.NullOr(Schema.Number),
  f50GroundBallGets: Schema.NullOr(Schema.Number),
  interceptMarks: Schema.NullOr(Schema.Number),
  marksOnLead: Schema.NullOr(Schema.Number),
  contestedPossessionRate: Schema.NullOr(Schema.Number),
  contestOffOneOnOnes: Schema.NullOr(Schema.Number),
  contestOffWins: Schema.NullOr(Schema.Number),
  contestOffWinsPercentage: Schema.NullOr(Schema.Number),
  contestDefOneOnOnes: Schema.NullOr(Schema.Number),
  contestDefLosses: Schema.NullOr(Schema.Number),
  contestDefLossPercentage: Schema.NullOr(Schema.Number),
  centreBounceAttendances: Schema.NullOr(Schema.Number),
  kickins: Schema.NullOr(Schema.Number),
  kickinsPlayon: Schema.NullOr(Schema.Number),
  ruckContests: Schema.NullOr(Schema.Number),
  scoreLaunches: Schema.NullOr(Schema.Number),

  source: DataSourceSchema,
});

/** Per-player statistics for a single match. */
export type PlayerStats = typeof PlayerStatsSchema.Type;

/**
 * Partial-result envelope returned by season-level player-stats fetches.
 *
 * Season scrapes hit one page per game, so a single failed game should not
 * discard the rest of the season — but it must not be silent either. The
 * envelope carries both the stat lines that were scraped and the IDs of
 * matches whose per-game scrape failed. IDs share the namespace of
 * {@link PlayerStats.matchId} (e.g. `AT_…` for AFL Tables, `FW_…` for
 * FootyWire) so failures can be cross-referenced against returned rows.
 *
 * Total failure of the season-level request itself (e.g. the season page
 * is unreachable) is still reported as an `err` Result, not an envelope.
 *
 * Season-wide AFL API and scraper requests preserve successful matches and
 * list individual failures in `failedMatchIds`. A single-match failure remains
 * an error Result. No caller needs to discard successful matches after a
 * different match fails. Adapter loops remain source-specific (ADR-0003).
 */
export const SeasonPlayerStatsSchema = Schema.Struct({
  /** Per-player stat lines for every game that was fetched successfully. */
  stats: Schema.Array(PlayerStatsSchema),
  /** Match IDs whose per-game fetch or parse failed (empty when complete). */
  failedMatchIds: Schema.Array(Schema.String),
});

/** Partial-result envelope returned by season-level player-stats fetches. */
export type SeasonPlayerStats = typeof SeasonPlayerStatsSchema.Type;

// ---------------------------------------------------------------------------
// Lineup / roster
// ---------------------------------------------------------------------------

/** A single player's position in a match lineup. */
export const LineupPlayerSchema = Schema.Struct({
  playerId: Schema.String,
  givenName: Schema.String,
  surname: Schema.String,
  displayName: Schema.String,
  jumperNumber: Schema.NullOr(Schema.Number),
  /**
   * On-field role assigned for THIS match (e.g. "Forward Pocket Right",
   * "BACK_POCKET"). Distinct from `Player.position` (career standing
   * role) — renamed in 2.1.0 to disambiguate the two semantics. (#96)
   */
  matchPosition: Schema.NullOr(Schema.String),
  isEmergency: Schema.Boolean,
  isSubstitute: Schema.Boolean,
});

/** A single player's position in a match lineup. */
export type LineupPlayer = typeof LineupPlayerSchema.Type;

/** Full lineup for a match (both teams). */
export const LineupSchema = Schema.Struct({
  matchId: Schema.String,
  season: Schema.Number,
  /** Canonical competition-season identity, populated by public fetch APIs. */
  seasonKey: Schema.optionalKey(Schema.String),
  roundNumber: Schema.Number,
  homeTeam: Schema.String,
  awayTeam: Schema.String,
  homePlayers: Schema.Array(LineupPlayerSchema),
  awayPlayers: Schema.Array(LineupPlayerSchema),
  competition: CompetitionCodeSchema,
  /** Adapter that produced this lineup (#120). */
  source: DataSourceSchema,
});

/** Full lineup for a match (both teams). */
export type Lineup = typeof LineupSchema.Type;

// ---------------------------------------------------------------------------
// Ladder
// ---------------------------------------------------------------------------

/** A single team's standing in the ladder. */
export const LadderEntrySchema = Schema.Struct({
  position: Schema.Number,
  team: Schema.String,
  played: Schema.Number,
  wins: Schema.Number,
  losses: Schema.Number,
  draws: Schema.Number,
  pointsFor: Schema.Number,
  pointsAgainst: Schema.Number,
  percentage: Schema.Number,
  premiershipsPoints: Schema.Number,
  form: Schema.NullOr(Schema.String),
});

/** A single team's standing in the ladder. */
export type LadderEntry = typeof LadderEntrySchema.Type;

/** Season ladder snapshot (optionally for a specific round). */
export const LadderSchema = Schema.Struct({
  season: Schema.Number,
  /** Canonical competition-season identity, populated by public fetch APIs. */
  seasonKey: Schema.optionalKey(Schema.String),
  roundNumber: Schema.NullOr(Schema.Number),
  entries: Schema.Array(LadderEntrySchema),
  competition: CompetitionCodeSchema,
  /** Adapter that produced the snapshot (#120). */
  source: DataSourceSchema,
  /**
   * Match ID of the most recent completed match the snapshot reflects, when
   * known. Adapters that synthesise the ladder from match results populate
   * this with the latest input `matchId`; the AFL API source populates it
   * from the upstream snapshot metadata when available. `null` when the
   * snapshot is round-aligned (no sub-round granularity needed) or when
   * the source doesn't expose it.
   */
  asOfMatch: Schema.NullOr(Schema.String),
});

/** Season ladder snapshot (optionally for a specific round). */
export type Ladder = typeof LadderSchema.Type;

// ---------------------------------------------------------------------------
// Team and squad
// ---------------------------------------------------------------------------

/** Time scope represented by a squad or player-details response. */
export const SquadScopeSchema = Schema.Literals(["season", "all-time"]);

/** Time scope represented by a squad or player-details response. */
export type SquadScope = typeof SquadScopeSchema.Type;

/** An AFL team. */
export const TeamSchema = Schema.Struct({
  teamId: Schema.String,
  name: Schema.String,
  abbreviation: Schema.String,
  competition: CompetitionCodeSchema,
  /** Adapter that supplied this team row (#120). */
  source: DataSourceSchema,
});

/** An AFL team. */
export type Team = typeof TeamSchema.Type;

/**
 * Canonical player record. One shape for every operation that returns
 * player data — squad rosters, biographical details, and any future
 * player-shaped surface (e.g. injuries, contract status). Bio fields
 * are nullable so per-source coverage gaps round-trip honestly.
 *
 * `LineupPlayer` is intentionally NOT this shape — the AFL match roster
 * endpoint doesn't carry bio data, so the lineup type stays its own
 * lean record. (#96)
 */
export const PlayerSchema = Schema.Struct({
  playerId: Schema.String,
  givenName: Schema.String,
  surname: Schema.String,
  displayName: Schema.String,
  jumperNumber: Schema.NullOr(Schema.Number),
  /** Career standing position (e.g. `KEY_FORWARD`). Nullable per source. */
  position: Schema.NullOr(Schema.String),
  /** ISO 8601 date string (`"YYYY-MM-DD"`). Nullable per source. */
  dateOfBirth: Schema.NullOr(Schema.String),
  heightCm: Schema.NullOr(Schema.Number),
  weightKg: Schema.NullOr(Schema.Number),
  draftYear: Schema.NullOr(Schema.Number),
  draftPosition: Schema.NullOr(Schema.Number),
  draftType: Schema.NullOr(Schema.String),
  debutYear: Schema.NullOr(Schema.Number),
  recruitedFrom: Schema.NullOr(Schema.String),
  /**
   * Career games played. Populated by FootyWire and AFL Tables (their
   * team-list pages carry career counts). `null` for `afl-api` — the
   * squad endpoint doesn't carry career stats.
   */
  gamesPlayed: Schema.NullOr(Schema.Number),
  /** Career goals. Populated alongside `gamesPlayed`; same source caveat. */
  goals: Schema.NullOr(Schema.Number),
  team: Schema.String,
  source: DataSourceSchema,
  competition: CompetitionCodeSchema,
});

/** Canonical player record (squad rosters, biographical details). */
export type Player = typeof PlayerSchema.Type;

/** A team's squad for a given season. */
export const SquadSchema = Schema.Struct({
  teamId: Schema.String,
  teamName: Schema.String,
  season: Schema.Number,
  /** Canonical competition-season identity, populated by public fetch APIs. */
  seasonKey: Schema.optionalKey(Schema.String),
  /** Whether players belong to the requested season or the source's all-time roster. */
  scope: SquadScopeSchema,
  players: Schema.Array(PlayerSchema),
  competition: CompetitionCodeSchema,
  /** Adapter that produced this squad (#120). */
  source: DataSourceSchema,
});

/** A team's squad for a given season. */
export type Squad = typeof SquadSchema.Type;

/**
 * Discriminated union returned by the `team` CLI verb. Each variant
 * wraps the existing typed shape for that mode so JSON consumers can
 * deserialise into a known type via the `mode` discriminator. (#99)
 *
 * - `list`: bare `team` invocation — list of teams in a competition.
 * - `squad`: `team --season Y --name X` — a team's roster for a season.
 * - `lineup`: `team --season Y --round R [--name X]` — match-day lineups.
 */
export const TeamResponseSchema = Schema.Union([
  Schema.Struct({ mode: Schema.Literal("list"), teams: Schema.Array(TeamSchema) }),
  Schema.Struct({ mode: Schema.Literal("squad"), squad: SquadSchema }),
  Schema.Struct({ mode: Schema.Literal("lineup"), lineups: Schema.Array(LineupSchema) }),
]);

/** Discriminated union returned by the `team` CLI verb (#99). */
export type TeamResponse = typeof TeamResponseSchema.Type;

// ---------------------------------------------------------------------------
// Player details (biographical data)
// ---------------------------------------------------------------------------

/**
 * Biographical details for a single player. Now an alias for the
 * canonical {@link Player} type — these were converged in 2.1.0. (#96)
 */
export const PlayerDetailsSchema = PlayerSchema;

/**
 * Biographical details for a single player. Now an alias for the
 * canonical {@link Player} type — these were converged in 2.1.0. (#96)
 */
export type PlayerDetails = Player;

/** Partial-result envelope for player biographical details. */
export const PlayerDetailsResultSchema = Schema.Struct({
  /** Players returned by successful squad requests. */
  players: Schema.Array(PlayerDetailsSchema),
  /** Canonical team names whose squad requests failed, in request order. */
  failedTeams: Schema.Array(Schema.String),
  /** Time scope shared by the returned squad data. */
  scope: SquadScopeSchema,
});

/** Partial-result envelope for player biographical details. */
export type PlayerDetailsResult = typeof PlayerDetailsResultSchema.Type;

/** Query parameters for fetching player details. */
export const PlayerDetailsQuerySchema = Schema.Struct({
  source: DataSourceSchema,
  /** Team name. When omitted, returns details for all teams. */
  team: Schema.optional(Schema.String),
  season: Schema.optional(SeasonSelectorSchema),
  current: Schema.optional(Schema.Boolean),
  competition: Schema.optional(CompetitionCodeSchema),
});

/** Query parameters for fetching player details. */
export type PlayerDetailsQuery = typeof PlayerDetailsQuerySchema.Type;

// ---------------------------------------------------------------------------
// Awards
// ---------------------------------------------------------------------------

/** Types of awards available. */
export const AwardTypeSchema = Schema.Literals([
  "brownlow",
  "all-australian",
  "rising-star",
  "coleman",
  "coaches",
]);

/** Types of awards available. */
export type AwardType = typeof AwardTypeSchema.Type;

/** A Brownlow Medal vote tally for a player. */
export const BrownlowVoteSchema = Schema.Struct({
  type: Schema.Literal("brownlow"),
  season: Schema.Number,
  /** Canonical competition-season identity, populated by public fetch APIs. */
  seasonKey: Schema.optionalKey(Schema.String),
  competition: CompetitionCodeSchema,
  /** Adapter that scraped this vote tally (#120). */
  source: DataSourceSchema,
  player: Schema.String,
  team: Schema.String,
  votes: Schema.Number,
  votes3: Schema.Number,
  votes2: Schema.Number,
  votes1: Schema.Number,
  gamesPolled: Schema.NullOr(Schema.Number),
  /**
   * Number of games where this player polled at least 1 vote
   * (R fitzRoy parity — `Polled` column).
   */
  polledGames: Schema.NullOr(Schema.Number),
  /**
   * True for the Brownlow medallist of the season (R fitzRoy denotes
   * this with a trailing " W" suffix on the player name; the suffix is
   * stripped from `player` and surfaced here as a structured boolean).
   */
  isMedallist: Schema.Boolean,
});

/** A Brownlow Medal vote tally for a player. */
export type BrownlowVote = typeof BrownlowVoteSchema.Type;

/** An All-Australian team selection. */
export const AllAustralianSelectionSchema = Schema.Struct({
  type: Schema.Literal("all-australian"),
  season: Schema.Number,
  /** Canonical competition-season identity, populated by public fetch APIs. */
  seasonKey: Schema.optionalKey(Schema.String),
  competition: CompetitionCodeSchema,
  /** Adapter that scraped this selection (#120). */
  source: DataSourceSchema,
  /** Footy position (e.g. `FB`, `HBF`, `C`). */
  position: Schema.String,
  player: Schema.String,
  team: Schema.String,
});

/** An All-Australian team selection. */
export type AllAustralianSelection = typeof AllAustralianSelectionSchema.Type;

/** A Rising Star nomination with stats. */
export const RisingStarNominationSchema = Schema.Struct({
  type: Schema.Literal("rising-star"),
  season: Schema.Number,
  /** Canonical competition-season identity, populated by public fetch APIs. */
  seasonKey: Schema.optionalKey(Schema.String),
  competition: CompetitionCodeSchema,
  /** Adapter that scraped this nomination (#120). */
  source: DataSourceSchema,
  round: Schema.Number,
  player: Schema.String,
  team: Schema.String,
  opponent: Schema.String,
  kicks: Schema.NullOr(Schema.Number),
  handballs: Schema.NullOr(Schema.Number),
  disposals: Schema.NullOr(Schema.Number),
  marks: Schema.NullOr(Schema.Number),
  goals: Schema.NullOr(Schema.Number),
  behinds: Schema.NullOr(Schema.Number),
  tackles: Schema.NullOr(Schema.Number),
});

/** A Rising Star nomination with stats. */
export type RisingStarNomination = typeof RisingStarNominationSchema.Type;

/** A Coleman Medal leaderboard entry (top goal-kickers per season). */
export const ColemanLeaderSchema = Schema.Struct({
  type: Schema.Literal("coleman"),
  season: Schema.Number,
  /** Canonical competition-season identity, populated by public fetch APIs. */
  seasonKey: Schema.optionalKey(Schema.String),
  competition: CompetitionCodeSchema,
  /** Adapter that produced this leaderboard entry (#120). */
  source: DataSourceSchema,
  /** 1 = season leader, 2 = runner-up, etc. */
  rank: Schema.Number,
  player: Schema.String,
  team: Schema.String,
  goals: Schema.Number,
  gamesPlayed: Schema.NullOr(Schema.Number),
});

/** A Coleman Medal leaderboard entry (top goal-kickers per season). */
export type ColemanLeader = typeof ColemanLeaderSchema.Type;

// ---------------------------------------------------------------------------
// Coaches votes
// ---------------------------------------------------------------------------

/** AFLCA coaches votes for a player in a single match. */
export const CoachesVoteSchema = Schema.Struct({
  type: Schema.Literal("coaches"),
  season: Schema.Number,
  /** Canonical competition-season identity, populated by public fetch APIs. */
  seasonKey: Schema.optionalKey(Schema.String),
  competition: CompetitionCodeSchema,
  /** Adapter that scraped this vote line (#120). */
  source: DataSourceSchema,
  round: Schema.Number,
  homeTeam: Schema.String,
  awayTeam: Schema.String,
  /** Player who received the votes (renamed from `playerName` in 2.1.0 for variant alignment). */
  player: Schema.String,
  votes: Schema.Number,
});

/** AFLCA coaches votes for a player in a single match. */
export type CoachesVote = typeof CoachesVoteSchema.Type;

/** Query parameters for fetching coaches votes. */
export const CoachesVoteQuerySchema = Schema.Struct({
  season: Schema.Number,
  round: Schema.optional(Schema.Number),
  competition: Schema.optional(CompetitionCodeSchema),
  team: Schema.optional(Schema.String),
});

/** Query parameters for fetching coaches votes. */
export type CoachesVoteQuery = typeof CoachesVoteQuerySchema.Type;

/** Partial-result envelope for a season of AFL Coaches Association votes. */
export const CoachesVotesResultSchema = Schema.Struct({
  /** Vote rows retained from successful rounds. */
  votes: Schema.Array(CoachesVoteSchema),
  /** Rounds with network, non-404 HTTP, or parse failures. */
  failedRounds: Schema.Array(Schema.Number),
});

/** Partial-result envelope for a season of AFL Coaches Association votes. */
export type CoachesVotesResult = typeof CoachesVotesResultSchema.Type;

// ---------------------------------------------------------------------------
// Award union and queries
// ---------------------------------------------------------------------------

/** Discriminated union of award types. */
export const AwardSchema = Schema.Union([
  BrownlowVoteSchema,
  AllAustralianSelectionSchema,
  RisingStarNominationSchema,
  ColemanLeaderSchema,
  CoachesVoteSchema,
]);

/** Discriminated union of award types. */
export type Award = typeof AwardSchema.Type;

/** Query parameters for fetching awards. */
export const AwardQuerySchema = Schema.Struct({
  award: AwardTypeSchema,
  season: SeasonSelectorSchema,
  /** Coaches votes are competition-scoped; defaults to AFLM. Other awards ignore. */
  competition: Schema.optional(CompetitionCodeSchema),
  /** Coaches votes only — narrow to a specific round. */
  round: Schema.optional(Schema.Number),
  /** Coaches votes only — narrow to matches involving a team. */
  team: Schema.optional(Schema.String),
  /** Coleman only — limit to top N goal-kickers (default: all players who scored). */
  limit: Schema.optional(Schema.Number),
});

/** Query parameters for fetching awards. */
export type AwardQuery = typeof AwardQuerySchema.Type;

/** Partial-result envelope for awards data. */
export const AwardResultSchema = Schema.Struct({
  /** Award rows that were fetched or computed successfully. */
  awards: Schema.Array(AwardSchema),
  /** Coaches-vote rounds that failed to fetch or parse, in round order. */
  failedRounds: Schema.Array(Schema.Number),
});

/** Partial-result envelope for awards data. */
export type AwardResult = typeof AwardResultSchema.Type;

// ---------------------------------------------------------------------------
// Query parameter types
// ---------------------------------------------------------------------------

/** Query for data by season and optional round. */
export const SeasonRoundQuerySchema = Schema.Struct({
  source: DataSourceSchema,
  season: SeasonSelectorSchema,
  round: Schema.optional(Schema.Number),
  competition: Schema.optional(CompetitionCodeSchema),
});

/** Query for data by season and optional round. */
export type SeasonRoundQuery = typeof SeasonRoundQuerySchema.Type;

/**
 * Unified query for matches in any temporal scope.
 *
 * - `season` is required (matches are always season-scoped)
 * - `round` narrows to one round
 * - `matchId` narrows to one specific match
 * - `team` filters to matches involving the named team (home or away)
 * - `status` filters by match state (e.g. "Upcoming" for fixtures only)
 */
export const MatchQuerySchema = Schema.Struct({
  source: DataSourceSchema,
  season: SeasonSelectorSchema,
  round: Schema.optional(Schema.Number),
  matchId: Schema.optional(Schema.String),
  team: Schema.optional(Schema.String),
  status: Schema.optional(MatchStatusSchema),
  competition: Schema.optional(CompetitionCodeSchema),
});

/** Unified query for matches in any temporal scope. */
export type MatchQuery = typeof MatchQuerySchema.Type;

/** Query for player stats (by season/round or specific match). */
export const PlayerStatsQuerySchema = Schema.Struct({
  source: DataSourceSchema,
  season: SeasonSelectorSchema,
  round: Schema.optional(Schema.Number),
  matchId: Schema.optional(Schema.String),
  competition: Schema.optional(CompetitionCodeSchema),
});

/** Query for player stats (by season/round or specific match). */
export type PlayerStatsQuery = typeof PlayerStatsQuerySchema.Type;

/** Query for lineup data. */
export const LineupQuerySchema = Schema.Struct({
  source: DataSourceSchema,
  season: SeasonSelectorSchema,
  round: Schema.Number,
  matchId: Schema.optional(Schema.String),
  competition: Schema.optional(CompetitionCodeSchema),
});

/** Query for lineup data. */
export type LineupQuery = typeof LineupQuerySchema.Type;

/** Query for ladder standings. */
export const LadderQuerySchema = Schema.Struct({
  source: DataSourceSchema,
  season: SeasonSelectorSchema,
  round: Schema.optional(Schema.Number),
  competition: Schema.optional(CompetitionCodeSchema),
});

/** Query for ladder standings. */
export type LadderQuery = typeof LadderQuerySchema.Type;

/** Query for team lists. */
export const TeamQuerySchema = Schema.Struct({
  competition: Schema.optional(CompetitionCodeSchema),
  teamType: Schema.optional(Schema.String),
});

/** Query for team lists. */
export type TeamQuery = typeof TeamQuerySchema.Type;

/** Query for a team's squad. */
export const SquadQuerySchema = Schema.Struct({
  /** Canonical team name (e.g. "Carlton"). Adapters handle their own translation. */
  team: Schema.String,
  season: SeasonSelectorSchema,
  source: Schema.optional(DataSourceSchema),
  competition: Schema.optional(CompetitionCodeSchema),
});

/** Query for a team's squad. */
export type SquadQuery = typeof SquadQuerySchema.Type;

// ---------------------------------------------------------------------------
// Team statistics (aggregate per-team stats)
// ---------------------------------------------------------------------------

/** Summary type for team statistics. */
export const TeamStatsSummaryTypeSchema = Schema.Literals(["totals", "averages"]);

/** Summary type for team statistics. */
export type TeamStatsSummaryType = typeof TeamStatsSummaryTypeSchema.Type;

/**
 * Canonical, source-portable team-stat metric set. Every metric is
 * nullable so source-asymmetric data (e.g. AFL Tables exposes
 * `brownlowVotes` aggregates; FootyWire exposes `fantasyPoints`/
 * `supercoachPoints`) round-trips honestly. Adapters handle their
 * source→canonical mapping. (#98)
 */
export const TeamMetricSetSchema = Schema.Struct({
  kicks: Schema.NullOr(Schema.Number),
  handballs: Schema.NullOr(Schema.Number),
  disposals: Schema.NullOr(Schema.Number),
  marks: Schema.NullOr(Schema.Number),
  goals: Schema.NullOr(Schema.Number),
  behinds: Schema.NullOr(Schema.Number),
  goalAssists: Schema.NullOr(Schema.Number),
  tackles: Schema.NullOr(Schema.Number),
  hitouts: Schema.NullOr(Schema.Number),
  freesFor: Schema.NullOr(Schema.Number),
  freesAgainst: Schema.NullOr(Schema.Number),
  clearances: Schema.NullOr(Schema.Number),
  clangers: Schema.NullOr(Schema.Number),
  inside50s: Schema.NullOr(Schema.Number),
  rebound50s: Schema.NullOr(Schema.Number),
  contestedPossessions: Schema.NullOr(Schema.Number),
  uncontestedPossessions: Schema.NullOr(Schema.Number),
  contestedMarks: Schema.NullOr(Schema.Number),
  marksInside50: Schema.NullOr(Schema.Number),
  onePercenters: Schema.NullOr(Schema.Number),
  bounces: Schema.NullOr(Schema.Number),
  brownlowVotes: Schema.NullOr(Schema.Number),
  fantasyPoints: Schema.NullOr(Schema.Number),
  supercoachPoints: Schema.NullOr(Schema.Number),
});

/** Canonical, source-portable team-stat metric set (#98). */
export type TeamMetricSet = typeof TeamMetricSetSchema.Type;

/**
 * Aggregate statistics for a single team in a season. Replaces the
 * source-specific `stats: Record<string, number>` with canonical
 * `for`/`against` metric sets so the shape is portable across sources.
 * (#98)
 */
export const TeamStatsEntrySchema = Schema.Struct({
  season: Schema.Number,
  /** Canonical competition-season identity, populated by public fetch APIs. */
  seasonKey: Schema.optionalKey(Schema.String),
  competition: CompetitionCodeSchema,
  team: Schema.String,
  /** Games used as the denominator, or `null` when enrichment failed. */
  gamesPlayed: Schema.NullOr(Schema.Number),
  for: TeamMetricSetSchema,
  against: TeamMetricSetSchema,
  source: DataSourceSchema,
});

/** Aggregate statistics for a single team in a season (#98). */
export type TeamStatsEntry = typeof TeamStatsEntrySchema.Type;

/** Query parameters for fetching team statistics. */
export const TeamStatsQuerySchema = Schema.Struct({
  source: DataSourceSchema,
  season: SeasonSelectorSchema,
  /** Competition to query. Defaults to `AFLM`. */
  competition: Schema.optional(CompetitionCodeSchema),
  summaryType: Schema.optional(TeamStatsSummaryTypeSchema),
});

/** Query parameters for fetching team statistics. */
export type TeamStatsQuery = typeof TeamStatsQuerySchema.Type;

/** Provider-backed identity of one competition season. */
export const CompetitionSeasonSchema = Schema.Struct({
  competition: CompetitionCodeSchema,
  seasonKey: Schema.String,
  year: Schema.Number,
  displayName: Schema.String,
  providerSeasonId: Schema.Number,
});

/** Provider-backed identity of one competition season. */
export type CompetitionSeason = typeof CompetitionSeasonSchema.Type;
