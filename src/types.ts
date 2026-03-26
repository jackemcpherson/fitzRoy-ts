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
export type DataSource = "afl-api" | "footywire" | "afl-tables" | "squiggle";

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

  /** Fantasy. */
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
  readonly team: string;
  readonly season?: number | undefined;
  readonly current?: boolean | undefined;
  readonly competition?: CompetitionCode | undefined;
}

// ---------------------------------------------------------------------------
// Awards
// ---------------------------------------------------------------------------

/** Types of awards available. */
export type AwardType = "brownlow" | "all-australian" | "rising-star";

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

/** Discriminated union of award types. */
export type Award = BrownlowVote | AllAustralianSelection | RisingStarNomination;

/** Query parameters for fetching awards. */
export interface AwardQuery {
  readonly award: AwardType;
  readonly season: number;
}

// ---------------------------------------------------------------------------
// Coaches votes
// ---------------------------------------------------------------------------

/** AFLCA coaches votes for a player in a single match. */
export interface CoachesVote {
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
