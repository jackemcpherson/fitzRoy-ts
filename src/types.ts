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
export type CompetitionCode = "AFLM" | "AFLW";

/** Round classification. */
export type RoundType = "HomeAndAway" | "Finals";

/** Supported data sources mirroring the R package's `source` parameter. */
export type DataSource = "afl-api" | "footywire" | "afl-tables";

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
// Match result
// ---------------------------------------------------------------------------

/**
 * A completed or in-progress match with scores.
 *
 * One row per match. Quarter scores are optional — historical data
 * from AFL Tables may not include them.
 */
export interface MatchResult {
  /** Provider-assigned match identifier (e.g. AFL API `matchProviderId`). */
  readonly matchId: string;
  readonly season: number;
  readonly roundNumber: number;
  readonly roundType: RoundType;
  readonly date: Date;
  readonly venue: string;
  readonly homeTeam: string;
  readonly awayTeam: string;

  /** Total goals-behinds-points for each team. */
  readonly homeGoals: number;
  readonly homeBehinds: number;
  readonly homePoints: number;
  readonly awayGoals: number;
  readonly awayBehinds: number;
  readonly awayPoints: number;

  /** Positive = home win, negative = away win. */
  readonly margin: number;

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

  /** Fantasy and awards. */
  readonly dreamTeamPoints: number | null;
  readonly supercoachPoints: number | null;
  readonly brownlowVotes: number | null;

  readonly source: DataSource;
}

// ---------------------------------------------------------------------------
// Fixture (upcoming/scheduled matches)
// ---------------------------------------------------------------------------

/** A scheduled match (may not yet have scores). */
export interface Fixture {
  readonly matchId: string;
  readonly season: number;
  readonly roundNumber: number;
  readonly roundType: RoundType;
  readonly date: Date;
  readonly venue: string;
  readonly homeTeam: string;
  readonly awayTeam: string;
  readonly status: MatchStatus;
  readonly competition: CompetitionCode;
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
}

/** A team's squad for a given season. */
export interface Squad {
  readonly teamId: string;
  readonly teamName: string;
  readonly season: number;
  readonly players: readonly SquadPlayer[];
  readonly competition: CompetitionCode;
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

/** Query for a specific match. */
export interface MatchQuery {
  readonly source: DataSource;
  readonly matchId: string;
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
  readonly teamId: string;
  readonly season: number;
  readonly competition?: CompetitionCode | undefined;
}
