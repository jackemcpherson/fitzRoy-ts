/**
 * Shared domain types for fitzRoy-ts.
 *
 * Define all domain types here before writing implementation code.
 * Types are the single source of truth for the data model.
 */

// ---------------------------------------------------------------------------
// Enums-as-unions
// ---------------------------------------------------------------------------

/** AFL competition codes. */
export type CompetitionCode = "AFLM" | "AFLW" | "VFL" | "VFLW";

/** Round classification. */
export type RoundType = "HomeAndAway" | "Finals";

/** Supported data sources mirroring the R package's `source` parameter. */
export type DataSource = "afl-api" | "footywire" | "afl-tables" | "squiggle" | "fryzigg";

/** Match status as reported by the AFL API. */
export type MatchStatus = "Upcoming" | "Live" | "Complete" | "Postponed" | "Cancelled";

// ---------------------------------------------------------------------------
// Score types
// ---------------------------------------------------------------------------

/** Goals-behinds-points breakdown for a single quarter. */
export interface QuarterScore {
  readonly goals: number;
  readonly behinds: number;
  readonly points: number;
}

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
export interface Match {
  /** Provider-assigned match identifier (e.g. AFL API `matchProviderId`). */
  readonly matchId: string;
  readonly season: number;
  readonly roundNumber: number;
  readonly roundType: RoundType;
  /**
   * Human-readable round name (e.g. "Round 1", "Qualifying Final"). Populated
   * by AFL API, AFL Tables, and FootyWire; null only for sources that don't
   * expose round labels (e.g. Squiggle).
   */
  readonly roundName: string | null;
  readonly date: Date;
  readonly venue: string;
  readonly homeTeam: string;
  readonly awayTeam: string;

  /**
   * Total goals-behinds-points for each team. Null when the match has not
   * yet been played (status="Upcoming").
   */
  readonly homeGoals: number | null;
  readonly homeBehinds: number | null;
  readonly homePoints: number | null;
  readonly awayGoals: number | null;
  readonly awayBehinds: number | null;
  readonly awayPoints: number | null;

  /** Positive = home win, negative = away win. Null for upcoming matches. */
  readonly margin: number | null;

  /** Per-quarter scores (null when unavailable). */
  readonly q1Home: QuarterScore | null;
  readonly q2Home: QuarterScore | null;
  readonly q3Home: QuarterScore | null;
  readonly q4Home: QuarterScore | null;
  readonly q1Away: QuarterScore | null;
  readonly q2Away: QuarterScore | null;
  readonly q3Away: QuarterScore | null;
  readonly q4Away: QuarterScore | null;

  readonly status: MatchStatus;
  readonly attendance: number | null;

  /** Weather conditions at the venue (null when unavailable). */
  readonly weatherTempCelsius: number | null;
  readonly weatherType: string | null;

  /**
   * Normalised round code (e.g. "R1", "QF", "GF"). Populated by AFL API, AFL
   * Tables, and FootyWire; null only for sources that don't expose round
   * labels (e.g. Squiggle).
   */
  readonly roundCode: string | null;

  /** Venue metadata (null for scraped sources). */
  readonly venueState: string | null;
  readonly venueTimezone: string | null;

  /** Rushed behinds per team (null when unavailable). */
  readonly homeRushedBehinds: number | null;
  readonly awayRushedBehinds: number | null;

  /** Minutes each team spent in front (null when unavailable). */
  readonly homeMinutesInFront: number | null;
  readonly awayMinutesInFront: number | null;

  readonly source: DataSource;
  readonly competition: CompetitionCode;
}

// ---------------------------------------------------------------------------
// Player statistics
// ---------------------------------------------------------------------------

/**
 * Per-player statistics for a single match.
 *
 * Fields are nullable because not all stats are available for every
 * era or source.
 */
export interface PlayerStats {
  readonly matchId: string;
  readonly season: number;
  readonly roundNumber: number;
  readonly team: string;
  readonly competition: CompetitionCode;

  /** Match context for cross-source joins (null when unavailable). */
  readonly date: Date | null;
  readonly homeTeam: string | null;
  readonly awayTeam: string | null;

  /** Player identification. */
  readonly playerId: string;
  readonly givenName: string;
  readonly surname: string;
  readonly displayName: string;
  readonly jumperNumber: number | null;

  /** Core stats. */
  readonly kicks: number | null;
  readonly handballs: number | null;
  readonly disposals: number | null;
  readonly marks: number | null;
  readonly goals: number | null;
  readonly behinds: number | null;
  readonly tackles: number | null;
  readonly hitouts: number | null;
  readonly freesFor: number | null;
  readonly freesAgainst: number | null;

  /** Contested/uncontested. */
  readonly contestedPossessions: number | null;
  readonly uncontestedPossessions: number | null;
  readonly contestedMarks: number | null;
  readonly intercepts: number | null;

  /** Clearances. */
  readonly centreClearances: number | null;
  readonly stoppageClearances: number | null;
  readonly totalClearances: number | null;

  /** Other stats. */
  readonly inside50s: number | null;
  readonly rebound50s: number | null;
  readonly clangers: number | null;
  readonly turnovers: number | null;
  readonly onePercenters: number | null;
  readonly bounces: number | null;
  readonly goalAssists: number | null;
  readonly disposalEfficiency: number | null;
  readonly metresGained: number | null;

  /** Additional base stats. */
  readonly goalAccuracy: number | null;
  readonly marksInside50: number | null;
  readonly tacklesInside50: number | null;
  readonly shotsAtGoal: number | null;
  readonly scoreInvolvements: number | null;
  readonly totalPossessions: number | null;
  readonly timeOnGroundPercentage: number | null;
  readonly ratingPoints: number | null;

  /** Position played in this match (e.g. "INT", "MIDFIELD"). Null when unavailable. */
  readonly position: string | null;

  /** Efficiency stats. */
  readonly goalEfficiency: number | null;
  readonly shotEfficiency: number | null;
  readonly interchangeCounts: number | null;

  /** Brownlow votes received in this match (null when unavailable). */
  readonly brownlowVotes: number | null;

  /** Fantasy. */
  readonly supercoachScore: number | null;
  readonly dreamTeamPoints: number | null;

  /** Extended stats. */
  readonly effectiveDisposals: number | null;
  readonly effectiveKicks: number | null;
  readonly kickEfficiency: number | null;
  readonly kickToHandballRatio: number | null;
  readonly pressureActs: number | null;
  readonly defHalfPressureActs: number | null;
  readonly spoils: number | null;
  readonly hitoutsToAdvantage: number | null;
  readonly hitoutWinPercentage: number | null;
  readonly hitoutToAdvantageRate: number | null;
  readonly groundBallGets: number | null;
  readonly f50GroundBallGets: number | null;
  readonly interceptMarks: number | null;
  readonly marksOnLead: number | null;
  readonly contestedPossessionRate: number | null;
  readonly contestOffOneOnOnes: number | null;
  readonly contestOffWins: number | null;
  readonly contestOffWinsPercentage: number | null;
  readonly contestDefOneOnOnes: number | null;
  readonly contestDefLosses: number | null;
  readonly contestDefLossPercentage: number | null;
  readonly centreBounceAttendances: number | null;
  readonly kickins: number | null;
  readonly kickinsPlayon: number | null;
  readonly ruckContests: number | null;
  readonly scoreLaunches: number | null;

  readonly source: DataSource;
}

// ---------------------------------------------------------------------------
// Lineup / roster
// ---------------------------------------------------------------------------

/** A single player's position in a match lineup. */
export interface LineupPlayer {
  readonly playerId: string;
  readonly givenName: string;
  readonly surname: string;
  readonly displayName: string;
  readonly jumperNumber: number | null;
  readonly position: string | null;
  readonly isEmergency: boolean;
  readonly isSubstitute: boolean;
}

/** Full lineup for a match (both teams). */
export interface Lineup {
  readonly matchId: string;
  readonly season: number;
  readonly roundNumber: number;
  readonly homeTeam: string;
  readonly awayTeam: string;
  readonly homePlayers: readonly LineupPlayer[];
  readonly awayPlayers: readonly LineupPlayer[];
  readonly competition: CompetitionCode;
}

// ---------------------------------------------------------------------------
// Ladder
// ---------------------------------------------------------------------------

/** A single team's standing in the ladder. */
export interface LadderEntry {
  readonly position: number;
  readonly team: string;
  readonly played: number;
  readonly wins: number;
  readonly losses: number;
  readonly draws: number;
  readonly pointsFor: number;
  readonly pointsAgainst: number;
  readonly percentage: number;
  readonly premiershipsPoints: number;
  readonly form: string | null;
}

/** Season ladder snapshot (optionally for a specific round). */
export interface Ladder {
  readonly season: number;
  readonly roundNumber: number | null;
  readonly entries: readonly LadderEntry[];
  readonly competition: CompetitionCode;
}

// ---------------------------------------------------------------------------
// Team and squad
// ---------------------------------------------------------------------------

/** An AFL team. */
export interface Team {
  readonly teamId: string;
  readonly name: string;
  readonly abbreviation: string;
  readonly competition: CompetitionCode;
}

/** A player within a team squad for a season. */
export interface SquadPlayer {
  readonly playerId: string;
  readonly givenName: string;
  readonly surname: string;
  readonly displayName: string;
  readonly jumperNumber: number | null;
  readonly position: string | null;
  readonly dateOfBirth: Date | null;
  readonly heightCm: number | null;
  readonly weightKg: number | null;
  readonly draftYear: number | null;
  readonly draftPosition: number | null;
  readonly draftType: string | null;
  readonly debutYear: number | null;
  readonly recruitedFrom: string | null;
  /**
   * Career games played. Populated by FootyWire and AFL Tables (their
   * team-list pages report career counts). `null` for `afl-api` — the
   * squad endpoint doesn't carry career stats.
   */
  readonly gamesPlayed?: number | null;
  /** Career goals. Populated alongside `gamesPlayed`; same source caveat. */
  readonly goals?: number | null;
}

/** A team's squad for a given season. */
export interface Squad {
  readonly teamId: string;
  readonly teamName: string;
  readonly season: number;
  readonly players: readonly SquadPlayer[];
  readonly competition: CompetitionCode;
}

/**
 * Discriminated union returned by the `team` CLI verb. Each variant
 * wraps the existing typed shape for that mode so JSON consumers can
 * deserialise into a known type via the `mode` discriminator. (#99)
 *
 * - `list`: bare `team` invocation — list of teams in a competition.
 * - `squad`: `team --season Y --name X` — a team's roster for a season.
 * - `lineup`: `team --season Y --round R [--name X]` — match-day lineups.
 */
export type TeamResponse =
  | { readonly mode: "list"; readonly teams: readonly Team[] }
  | { readonly mode: "squad"; readonly squad: Squad }
  | { readonly mode: "lineup"; readonly lineups: readonly Lineup[] };

// ---------------------------------------------------------------------------
// Player details (biographical data)
// ---------------------------------------------------------------------------

/** Biographical details for a single player. */
export interface PlayerDetails {
  readonly playerId: string;
  readonly givenName: string;
  readonly surname: string;
  readonly displayName: string;
  readonly team: string;
  readonly jumperNumber: number | null;
  readonly position: string | null;
  readonly dateOfBirth: string | null;
  readonly heightCm: number | null;
  readonly weightKg: number | null;
  /**
   * Career games played. `null` for `afl-api` source — the squad endpoint
   * does not provide career statistics. Use `footywire` or `afl-tables` for this field.
   */
  readonly gamesPlayed: number | null;
  readonly goals: number | null;
  readonly draftYear: number | null;
  readonly draftPosition: number | null;
  readonly draftType: string | null;
  readonly debutYear: number | null;
  readonly recruitedFrom: string | null;
  readonly source: DataSource;
  readonly competition: CompetitionCode;
}

/** Query parameters for fetching player details. */
export interface PlayerDetailsQuery {
  readonly source: DataSource;
  /** Team name. When omitted, returns details for all teams. */
  readonly team?: string | undefined;
  readonly season?: number | undefined;
  readonly current?: boolean | undefined;
  readonly competition?: CompetitionCode | undefined;
}

// ---------------------------------------------------------------------------
// Awards
// ---------------------------------------------------------------------------

/** Types of awards available. */
export type AwardType = "brownlow" | "all-australian" | "rising-star" | "coleman" | "coaches";

/** A Brownlow Medal vote tally for a player. */
export interface BrownlowVote {
  readonly type: "brownlow";
  readonly season: number;
  readonly player: string;
  readonly team: string;
  readonly votes: number;
  readonly votes3: number;
  readonly votes2: number;
  readonly votes1: number;
  readonly gamesPolled: number | null;
}

/** An All-Australian team selection. */
export interface AllAustralianSelection {
  readonly type: "all-australian";
  readonly season: number;
  readonly position: string;
  readonly player: string;
  readonly team: string;
}

/** A Rising Star nomination with stats. */
export interface RisingStarNomination {
  readonly type: "rising-star";
  readonly season: number;
  readonly round: number;
  readonly player: string;
  readonly team: string;
  readonly opponent: string;
  readonly kicks: number | null;
  readonly handballs: number | null;
  readonly disposals: number | null;
  readonly marks: number | null;
  readonly goals: number | null;
  readonly behinds: number | null;
  readonly tackles: number | null;
}

/** A Coleman Medal leaderboard entry (top goal-kickers per season). */
export interface ColemanLeader {
  readonly type: "coleman";
  readonly season: number;
  /** 1 = season leader, 2 = runner-up, etc. */
  readonly position: number;
  readonly player: string;
  readonly team: string;
  readonly goals: number;
  readonly gamesPlayed: number | null;
}

/** Discriminated union of award types. */
export type Award =
  | BrownlowVote
  | AllAustralianSelection
  | RisingStarNomination
  | ColemanLeader
  | CoachesVote;

/** Query parameters for fetching awards. */
export interface AwardQuery {
  readonly award: AwardType;
  readonly season: number;
  /** Coaches votes are competition-scoped; defaults to AFLM. Other awards ignore. */
  readonly competition?: CompetitionCode | undefined;
  /** Coaches votes only — narrow to a specific round. */
  readonly round?: number | undefined;
  /** Coaches votes only — narrow to matches involving a team. */
  readonly team?: string | undefined;
  /** Coleman only — limit to top N goal-kickers (default: all players who scored). */
  readonly limit?: number | undefined;
}

// ---------------------------------------------------------------------------
// Coaches votes
// ---------------------------------------------------------------------------

/** AFLCA coaches votes for a player in a single match. */
export interface CoachesVote {
  readonly type: "coaches";
  readonly season: number;
  readonly round: number;
  readonly homeTeam: string;
  readonly awayTeam: string;
  readonly playerName: string;
  readonly votes: number;
}

/** Query parameters for fetching coaches votes. */
export interface CoachesVoteQuery {
  readonly season: number;
  readonly round?: number | undefined;
  readonly competition?: CompetitionCode | undefined;
  readonly team?: string | undefined;
}

// ---------------------------------------------------------------------------
// Query parameter types
// ---------------------------------------------------------------------------

/** Query for data by season and optional round. */
export interface SeasonRoundQuery {
  readonly source: DataSource;
  readonly season: number;
  readonly round?: number | undefined;
  readonly competition?: CompetitionCode | undefined;
}

/**
 * Unified query for matches in any temporal scope.
 *
 * - `season` is required (matches are always season-scoped)
 * - `round` narrows to one round
 * - `matchId` narrows to one specific match
 * - `team` filters to matches involving the named team (home or away)
 * - `status` filters by match state (e.g. "Upcoming" for fixtures only)
 */
export interface MatchQuery {
  readonly source: DataSource;
  readonly season: number;
  readonly round?: number | undefined;
  readonly matchId?: string | undefined;
  readonly team?: string | undefined;
  readonly status?: MatchStatus | undefined;
  readonly competition?: CompetitionCode | undefined;
}

/** Query for player stats (by season/round or specific match). */
export interface PlayerStatsQuery {
  readonly source: DataSource;
  readonly season: number;
  readonly round?: number | undefined;
  readonly matchId?: string | undefined;
  readonly competition?: CompetitionCode | undefined;
}

/** Query for lineup data. */
export interface LineupQuery {
  readonly source: DataSource;
  readonly season: number;
  readonly round: number;
  readonly matchId?: string | undefined;
  readonly competition?: CompetitionCode | undefined;
}

/** Query for ladder standings. */
export interface LadderQuery {
  readonly source: DataSource;
  readonly season: number;
  readonly round?: number | undefined;
  readonly competition?: CompetitionCode | undefined;
}

/** Query for team lists. */
export interface TeamQuery {
  readonly competition?: CompetitionCode | undefined;
  readonly teamType?: string | undefined;
}

/** Query for a team's squad. */
export interface SquadQuery {
  /** Canonical team name (e.g. "Carlton"). Adapters handle their own translation. */
  readonly team: string;
  readonly season: number;
  readonly source?: DataSource | undefined;
  readonly competition?: CompetitionCode | undefined;
}

// ---------------------------------------------------------------------------
// Team statistics (aggregate per-team stats)
// ---------------------------------------------------------------------------

/** Summary type for team statistics. */
export type TeamStatsSummaryType = "totals" | "averages";

/**
 * Aggregate statistics for a single team in a season.
 *
 * The `stats` record uses flexible string keys because stat columns
 * differ between data sources (FootyWire vs AFL Tables).
 */
export interface TeamStatsEntry {
  readonly season: number;
  readonly team: string;
  readonly gamesPlayed: number;
  readonly stats: Readonly<Record<string, number>>;
  readonly source: DataSource;
}

/** Query parameters for fetching team statistics. */
export interface TeamStatsQuery {
  readonly source: DataSource;
  readonly season: number;
  readonly summaryType?: TeamStatsSummaryType | undefined;
}
