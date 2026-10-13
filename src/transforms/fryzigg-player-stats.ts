/**
 * Transform fryzigg column-major DataFrame into PlayerStats[].
 *
 * Fryzigg distributes the full historical dataset as a single file.
 * This transform filters rows by season/round on the column arrays
 * *before* constructing PlayerStats objects, avoiding allocation of
 * hundreds of thousands of objects when only a single season is needed.
 *
 * The AFLM and AFLW files have different column naming conventions.
 * A column-mapping dictionary resolves these differences so the row
 * mapper can work with pre-resolved column arrays.
 */

import type { DataFrame } from "@jackemcpherson/rds-js";
import { Schema } from "effect";

import { parseDate } from "../lib/date-utils";
import { ScrapeError } from "../lib/errors";
import { err, ok, type Result } from "../lib/result";
import { normaliseTeamName } from "../lib/team-mapping";
import type { CompetitionCode, PlayerStats } from "../types";

/** Parameters for filtering and mapping fryzigg data. */
export interface FryziggTransformOptions {
  readonly competition: CompetitionCode;
  readonly season?: number | undefined;
  readonly round?: number | undefined;
}

/**
 * Minimum columns required in either schema. We check for at least one
 * variant of each critical column.
 */
const REQUIRED_COLUMN_GROUPS = [
  ["match_id"],
  ["match_date", "date"],
  ["player_id"],
  ["player_team", "team"],
] as const;

/**
 * Column name mappings from PlayerStats fields to fryzigg column names.
 * AFLM and AFLW have different naming conventions for some columns.
 */
const AFLM_COLUMNS = {
  date: "match_date",
  homeTeam: "match_home_team",
  awayTeam: "match_away_team",
  team: "player_team",
  round: "match_round",
  jumperNumber: "guernsey_number",
  firstName: "player_first_name",
  lastName: "player_last_name",
  playerName: undefined,
  freesFor: "free_kicks_for",
  freesAgainst: "free_kicks_against",
  totalClearances: "clearances",
  inside50s: "inside_fifties",
  rebound50s: "rebounds",
  disposalEfficiency: "disposal_efficiency_percentage",
  marksInside50: "marks_inside_fifty",
  tacklesInside50: "tackles_inside_fifty",
  timeOnGround: "time_on_ground_percentage",
  position: "player_position",
  dreamTeamPoints: "afl_fantasy_score",
  totalPossessions: undefined,
} as const;

const AFLW_COLUMNS = {
  date: "date",
  homeTeam: "home_team",
  awayTeam: "away_team",
  team: "team",
  round: "fixture_round",
  jumperNumber: "number",
  firstName: undefined,
  lastName: undefined,
  playerName: "player_name",
  freesFor: "frees_for",
  freesAgainst: "frees_against",
  totalClearances: "total_clearances",
  inside50s: "inside50s",
  rebound50s: "rebound50s",
  disposalEfficiency: "disposal_efficiency",
  marksInside50: "marks_inside50",
  tacklesInside50: "tackles_inside50",
  timeOnGround: "time_on_ground",
  position: "position",
  dreamTeamPoints: "fantasy_score",
  totalPossessions: "total_possessions",
} as const;

/** All pre-resolved column arrays needed for row mapping. */
/**
 * One decoded data-frame column.
 *
 * R atomic vectors are homogeneous, and rds-js maps `NA` to `null`. A column
 * is therefore all strings, all numbers, or neither (logical vectors and
 * all-`NA` columns), plus `null` entries.
 */
type Column =
  | { readonly kind: "text"; readonly values: ReadonlyArray<string | null> }
  | { readonly kind: "number"; readonly values: ReadonlyArray<number | null> }
  | { readonly kind: "other"; readonly length: number };

const isTextColumn = Schema.is(Schema.Array(Schema.NullOr(Schema.String)));

const isNumberColumn = Schema.is(Schema.Array(Schema.NullOr(Schema.Number)));

/** Decode a raw data-frame column at the RDS boundary. */
function decodeColumn(values: readonly unknown[]): Column {
  if (isTextColumn(values)) return { kind: "text", values };

  if (isNumberColumn(values)) return { kind: "number", values };

  return { kind: "other", length: values.length };
}

interface ResolvedColumns {
  readonly matchId: Column | undefined;
  readonly date: Column | undefined;
  readonly homeTeam: Column | undefined;
  readonly awayTeam: Column | undefined;
  readonly team: Column | undefined;
  readonly round: Column | undefined;
  readonly jumperNumber: Column | undefined;
  readonly playerId: Column | undefined;
  readonly firstName: Column | undefined;
  readonly lastName: Column | undefined;
  readonly playerName: Column | undefined;
  readonly kicks: Column | undefined;
  readonly handballs: Column | undefined;
  readonly disposals: Column | undefined;
  readonly marks: Column | undefined;
  readonly goals: Column | undefined;
  readonly behinds: Column | undefined;
  readonly tackles: Column | undefined;
  readonly hitouts: Column | undefined;
  readonly freesFor: Column | undefined;
  readonly freesAgainst: Column | undefined;
  readonly contestedPossessions: Column | undefined;
  readonly uncontestedPossessions: Column | undefined;
  readonly contestedMarks: Column | undefined;
  readonly intercepts: Column | undefined;
  readonly centreClearances: Column | undefined;
  readonly stoppageClearances: Column | undefined;
  readonly totalClearances: Column | undefined;
  readonly inside50s: Column | undefined;
  readonly rebound50s: Column | undefined;
  readonly clangers: Column | undefined;
  readonly turnovers: Column | undefined;
  readonly onePercenters: Column | undefined;
  readonly bounces: Column | undefined;
  readonly goalAssists: Column | undefined;
  readonly disposalEfficiency: Column | undefined;
  readonly metresGained: Column | undefined;
  readonly marksInside50: Column | undefined;
  readonly tacklesInside50: Column | undefined;
  readonly shotsAtGoal: Column | undefined;
  readonly scoreInvolvements: Column | undefined;
  readonly totalPossessions: Column | undefined;
  readonly timeOnGround: Column | undefined;
  readonly ratingPoints: Column | undefined;
  readonly position: Column | undefined;
  readonly brownlowVotes: Column | undefined;
  readonly supercoachScore: Column | undefined;
  readonly dreamTeamPoints: Column | undefined;
  readonly effectiveDisposals: Column | undefined;
  readonly effectiveKicks: Column | undefined;
  readonly pressureActs: Column | undefined;
  readonly defHalfPressureActs: Column | undefined;
  readonly spoils: Column | undefined;
  readonly hitoutsToAdvantage: Column | undefined;
  readonly hitoutWinPercentage: Column | undefined;
  readonly groundBallGets: Column | undefined;
  readonly f50GroundBallGets: Column | undefined;
  readonly interceptMarks: Column | undefined;
  readonly marksOnLead: Column | undefined;
  readonly contestOffOneOnOnes: Column | undefined;
  readonly contestOffWins: Column | undefined;
  readonly contestDefOneOnOnes: Column | undefined;
  readonly contestDefLosses: Column | undefined;
  readonly ruckContests: Column | undefined;
  readonly scoreLaunches: Column | undefined;
}

/**
 * Transform a fryzigg DataFrame into filtered PlayerStats[].
 *
 * @param frame - Column-major data from FryziggClient.
 * @param options - Competition, season, and round filters.
 * @returns Filtered array of PlayerStats, or error if columns are missing.
 */
export function transformFryziggPlayerStats(
  frame: DataFrame,
  options: FryziggTransformOptions,
): Result<PlayerStats[], ScrapeError> {
  const colIndex = new Map<string, number>();

  for (let i = 0; i < frame.names.length; i++) {
    const name = frame.names[i];

    if (name !== undefined) {
      colIndex.set(name, i);
    }
  }

  for (const group of REQUIRED_COLUMN_GROUPS) {
    if (!group.some((name) => colIndex.has(name))) {
      return err(
        new ScrapeError(
          `Fryzigg data frame missing required column: "${group.join('" or "')}"`,
          "fryzigg",
        ),
      );
    }
  }

  // Resolve column by name (single lookup, used during column resolution phase only)
  const getCol = (name: string | undefined): Column | undefined => {
    if (name === undefined) return undefined;
    const idx = colIndex.get(name);

    if (idx === undefined) return undefined;
    const values = frame.columns[idx];

    return values ? decodeColumn(values) : undefined;
  };

  const isAflw = options.competition === "AFLW";
  const mapping = isAflw ? AFLW_COLUMNS : AFLM_COLUMNS;

  // Resolve all columns once before the row loop
  const cols: ResolvedColumns = {
    matchId: getCol("match_id"),
    date: getCol(mapping.date),
    homeTeam: getCol(mapping.homeTeam),
    awayTeam: getCol(mapping.awayTeam),
    team: getCol(mapping.team),
    round: getCol(mapping.round),
    jumperNumber: getCol(mapping.jumperNumber),
    playerId: getCol("player_id"),
    firstName: getCol(mapping.firstName),
    lastName: getCol(mapping.lastName),
    playerName: getCol(mapping.playerName),
    kicks: getCol("kicks"),
    handballs: getCol("handballs"),
    disposals: getCol("disposals"),
    marks: getCol("marks"),
    goals: getCol("goals"),
    behinds: getCol("behinds"),
    tackles: getCol("tackles"),
    hitouts: getCol("hitouts"),
    freesFor: getCol(mapping.freesFor),
    freesAgainst: getCol(mapping.freesAgainst),
    contestedPossessions: getCol("contested_possessions"),
    uncontestedPossessions: getCol("uncontested_possessions"),
    contestedMarks: getCol("contested_marks"),
    intercepts: getCol("intercepts"),
    centreClearances: getCol("centre_clearances"),
    stoppageClearances: getCol("stoppage_clearances"),
    totalClearances: getCol(mapping.totalClearances),
    inside50s: getCol(mapping.inside50s),
    rebound50s: getCol(mapping.rebound50s),
    clangers: getCol("clangers"),
    turnovers: getCol("turnovers"),
    onePercenters: getCol("one_percenters"),
    bounces: getCol("bounces"),
    goalAssists: getCol("goal_assists"),
    disposalEfficiency: getCol(mapping.disposalEfficiency),
    metresGained: getCol("metres_gained"),
    marksInside50: getCol(mapping.marksInside50),
    tacklesInside50: getCol(mapping.tacklesInside50),
    shotsAtGoal: getCol("shots_at_goal"),
    scoreInvolvements: getCol("score_involvements"),
    totalPossessions: getCol(mapping.totalPossessions),
    timeOnGround: getCol(mapping.timeOnGround),
    ratingPoints: getCol("rating_points"),
    position: getCol(mapping.position),
    brownlowVotes: getCol("brownlow_votes"),
    supercoachScore: getCol("supercoach_score"),
    dreamTeamPoints: getCol(mapping.dreamTeamPoints),
    effectiveDisposals: getCol("effective_disposals"),
    effectiveKicks: getCol("effective_kicks"),
    pressureActs: getCol("pressure_acts"),
    defHalfPressureActs: getCol("def_half_pressure_acts"),
    spoils: getCol("spoils"),
    hitoutsToAdvantage: getCol("hitouts_to_advantage"),
    hitoutWinPercentage: getCol("hitout_win_percentage"),
    groundBallGets: getCol("ground_ball_gets"),
    f50GroundBallGets: getCol("f50_ground_ball_gets"),
    interceptMarks: getCol("intercept_marks"),
    marksOnLead: getCol("marks_on_lead"),
    contestOffOneOnOnes: getCol("contest_off_one_on_ones"),
    contestOffWins: getCol("contest_off_wins"),
    contestDefOneOnOnes: getCol("contest_def_one_on_ones"),
    contestDefLosses: getCol("contest_def_losses"),
    ruckContests: getCol("ruck_contests"),
    scoreLaunches: getCol("score_launches"),
  };

  if (options.round !== undefined && cols.round === undefined) {
    return err(
      new ScrapeError(`Fryzigg data frame missing required column: "${mapping.round}"`, "fryzigg"),
    );
  }

  const dateCol = cols.date;
  const roundCol = cols.round;
  const nRows = dateCol ? columnLength(dateCol) : 0;
  const hasFilters = options.season !== undefined || options.round !== undefined;

  // Build matching row indices, or iterate all rows when no filters are active
  let rowIndices: number[] | null = null;

  if (hasFilters) {
    const matching: number[] = [];

    for (let i = 0; i < nRows; i++) {
      if (options.season !== undefined) {
        const dateStr = strAt(dateCol, i);

        if (dateStr === null) continue;
        const year = Number(dateStr.slice(0, 4));

        if (year !== options.season) continue;
      }

      if (options.round !== undefined && roundCol) {
        if (roundFilterAt(roundCol, i) !== options.round) continue;
      }

      matching.push(i);
    }

    rowIndices = matching;
  }

  const indices = rowIndices ?? Array.from({ length: nRows }, (_, j) => j);
  const stats: PlayerStats[] = indices.map((i) => mapRow(i, cols, isAflw, options.competition));

  return ok(stats);
}

/** Number of rows in a decoded column. */
function columnLength(column: Column): number {
  return column.kind === "other" ? column.length : column.values.length;
}

/** Extract a numeric value from a column at the given row index. */
function numAt(column: Column | undefined, i: number): number | null {
  return column?.kind === "number" ? (column.values[i] ?? null) : null;
}

/** Extract a string value from a column at the given row index. */
function strAt(column: Column | undefined, i: number): string | null {
  return column?.kind === "text" ? (column.values[i] ?? null) : null;
}

/** Render an identifier cell (text or numeric) as a string; missing is `""`. */
function idAt(column: Column | undefined, i: number): string {
  const value = column?.kind === "text" || column?.kind === "number" ? column.values[i] : null;

  return value === null || value === undefined ? "" : String(value);
}

/** Round value for filtering: numeric strings convert, missing is `null`. */
function roundFilterAt(column: Column, i: number): number | null {
  if (column.kind === "number") return column.values[i] ?? null;

  if (column.kind === "text") {
    const value = column.values[i];

    return value === null || value === undefined ? null : Number(value);
  }

  return null;
}

/** Parse round number, returning 0 for non-numeric values (e.g. "Semi Final"). */
function roundAt(column: Column | undefined, i: number): number {
  const value = column === undefined ? null : roundFilterAt(column, i);

  return value === null || Number.isNaN(value) ? 0 : value;
}

/** Map a single row from pre-resolved column arrays to a PlayerStats object. */
function mapRow(
  i: number,
  c: ResolvedColumns,
  isAflw: boolean,
  competition: CompetitionCode,
): PlayerStats {
  const dateStr = strAt(c.date, i);

  let firstName: string;
  let lastName: string;

  if (isAflw) {
    // AFLW player_name is "First, Last" format
    const playerName = strAt(c.playerName, i) ?? "";
    const commaIdx = playerName.indexOf(", ");
    firstName = commaIdx >= 0 ? playerName.slice(0, commaIdx) : playerName;
    lastName = commaIdx >= 0 ? playerName.slice(commaIdx + 2) : "";
  } else {
    firstName = strAt(c.firstName, i) ?? "";
    lastName = strAt(c.lastName, i) ?? "";
  }

  const team = strAt(c.team, i) ?? "";
  const homeTeam = strAt(c.homeTeam, i);
  const awayTeam = strAt(c.awayTeam, i);

  return {
    matchId: idAt(c.matchId, i),
    season: dateStr ? Number(dateStr.slice(0, 4)) : 0,
    roundNumber: roundAt(c.round, i),
    team: normaliseTeamName(team),
    competition,
    date: dateStr ? parseDate(dateStr) : null,
    homeTeam: homeTeam ? normaliseTeamName(homeTeam) : null,
    awayTeam: awayTeam ? normaliseTeamName(awayTeam) : null,

    playerId: idAt(c.playerId, i),
    givenName: firstName,
    surname: lastName,
    displayName: `${firstName} ${lastName}`.trim(),
    jumperNumber: numAt(c.jumperNumber, i),

    kicks: numAt(c.kicks, i),
    handballs: numAt(c.handballs, i),
    disposals: numAt(c.disposals, i),
    marks: numAt(c.marks, i),
    goals: numAt(c.goals, i),
    behinds: numAt(c.behinds, i),
    tackles: numAt(c.tackles, i),
    hitouts: numAt(c.hitouts, i),
    freesFor: numAt(c.freesFor, i),
    freesAgainst: numAt(c.freesAgainst, i),

    contestedPossessions: numAt(c.contestedPossessions, i),
    uncontestedPossessions: numAt(c.uncontestedPossessions, i),
    contestedMarks: numAt(c.contestedMarks, i),
    intercepts: numAt(c.intercepts, i),

    centreClearances: numAt(c.centreClearances, i),
    stoppageClearances: numAt(c.stoppageClearances, i),
    totalClearances: numAt(c.totalClearances, i),

    inside50s: numAt(c.inside50s, i),
    rebound50s: numAt(c.rebound50s, i),
    clangers: numAt(c.clangers, i),
    turnovers: numAt(c.turnovers, i),
    onePercenters: numAt(c.onePercenters, i),
    bounces: numAt(c.bounces, i),
    goalAssists: numAt(c.goalAssists, i),
    disposalEfficiency: numAt(c.disposalEfficiency, i),
    metresGained: numAt(c.metresGained, i),

    goalAccuracy: null,
    marksInside50: numAt(c.marksInside50, i),
    tacklesInside50: numAt(c.tacklesInside50, i),
    shotsAtGoal: numAt(c.shotsAtGoal, i),
    scoreInvolvements: numAt(c.scoreInvolvements, i),
    totalPossessions: numAt(c.totalPossessions, i),
    timeOnGroundPercentage: numAt(c.timeOnGround, i),
    ratingPoints: numAt(c.ratingPoints, i),

    position: strAt(c.position, i),

    goalEfficiency: null,
    shotEfficiency: null,
    interchangeCounts: null,

    brownlowVotes: numAt(c.brownlowVotes, i),

    supercoachScore: numAt(c.supercoachScore, i),
    dreamTeamPoints: numAt(c.dreamTeamPoints, i),

    effectiveDisposals: numAt(c.effectiveDisposals, i),
    effectiveKicks: numAt(c.effectiveKicks, i),
    kickEfficiency: null,
    kickToHandballRatio: null,
    pressureActs: numAt(c.pressureActs, i),
    defHalfPressureActs: numAt(c.defHalfPressureActs, i),
    spoils: numAt(c.spoils, i),
    hitoutsToAdvantage: numAt(c.hitoutsToAdvantage, i),
    hitoutWinPercentage: numAt(c.hitoutWinPercentage, i),
    hitoutToAdvantageRate: null,
    groundBallGets: numAt(c.groundBallGets, i),
    f50GroundBallGets: numAt(c.f50GroundBallGets, i),
    interceptMarks: numAt(c.interceptMarks, i),
    marksOnLead: numAt(c.marksOnLead, i),
    contestedPossessionRate: null,
    contestOffOneOnOnes: numAt(c.contestOffOneOnOnes, i),
    contestOffWins: numAt(c.contestOffWins, i),
    contestOffWinsPercentage: null,
    contestDefOneOnOnes: numAt(c.contestDefOneOnOnes, i),
    contestDefLosses: numAt(c.contestDefLosses, i),
    contestDefLossPercentage: null,
    centreBounceAttendances: null,
    kickins: null,
    kickinsPlayon: null,
    ruckContests: numAt(c.ruckContests, i),
    scoreLaunches: numAt(c.scoreLaunches, i),

    source: "fryzigg",
  };
}
