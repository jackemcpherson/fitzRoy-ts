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
interface ResolvedColumns {
  readonly matchId: unknown[] | undefined;
  readonly date: unknown[] | undefined;
  readonly homeTeam: unknown[] | undefined;
  readonly awayTeam: unknown[] | undefined;
  readonly team: unknown[] | undefined;
  readonly round: unknown[] | undefined;
  readonly jumperNumber: unknown[] | undefined;
  readonly playerId: unknown[] | undefined;
  readonly firstName: unknown[] | undefined;
  readonly lastName: unknown[] | undefined;
  readonly playerName: unknown[] | undefined;
  readonly kicks: unknown[] | undefined;
  readonly handballs: unknown[] | undefined;
  readonly disposals: unknown[] | undefined;
  readonly marks: unknown[] | undefined;
  readonly goals: unknown[] | undefined;
  readonly behinds: unknown[] | undefined;
  readonly tackles: unknown[] | undefined;
  readonly hitouts: unknown[] | undefined;
  readonly freesFor: unknown[] | undefined;
  readonly freesAgainst: unknown[] | undefined;
  readonly contestedPossessions: unknown[] | undefined;
  readonly uncontestedPossessions: unknown[] | undefined;
  readonly contestedMarks: unknown[] | undefined;
  readonly intercepts: unknown[] | undefined;
  readonly centreClearances: unknown[] | undefined;
  readonly stoppageClearances: unknown[] | undefined;
  readonly totalClearances: unknown[] | undefined;
  readonly inside50s: unknown[] | undefined;
  readonly rebound50s: unknown[] | undefined;
  readonly clangers: unknown[] | undefined;
  readonly turnovers: unknown[] | undefined;
  readonly onePercenters: unknown[] | undefined;
  readonly bounces: unknown[] | undefined;
  readonly goalAssists: unknown[] | undefined;
  readonly disposalEfficiency: unknown[] | undefined;
  readonly metresGained: unknown[] | undefined;
  readonly marksInside50: unknown[] | undefined;
  readonly tacklesInside50: unknown[] | undefined;
  readonly shotsAtGoal: unknown[] | undefined;
  readonly scoreInvolvements: unknown[] | undefined;
  readonly totalPossessions: unknown[] | undefined;
  readonly timeOnGround: unknown[] | undefined;
  readonly ratingPoints: unknown[] | undefined;
  readonly position: unknown[] | undefined;
  readonly brownlowVotes: unknown[] | undefined;
  readonly supercoachScore: unknown[] | undefined;
  readonly dreamTeamPoints: unknown[] | undefined;
  readonly effectiveDisposals: unknown[] | undefined;
  readonly effectiveKicks: unknown[] | undefined;
  readonly pressureActs: unknown[] | undefined;
  readonly defHalfPressureActs: unknown[] | undefined;
  readonly spoils: unknown[] | undefined;
  readonly hitoutsToAdvantage: unknown[] | undefined;
  readonly hitoutWinPercentage: unknown[] | undefined;
  readonly groundBallGets: unknown[] | undefined;
  readonly f50GroundBallGets: unknown[] | undefined;
  readonly interceptMarks: unknown[] | undefined;
  readonly marksOnLead: unknown[] | undefined;
  readonly contestOffOneOnOnes: unknown[] | undefined;
  readonly contestOffWins: unknown[] | undefined;
  readonly contestDefOneOnOnes: unknown[] | undefined;
  readonly contestDefLosses: unknown[] | undefined;
  readonly ruckContests: unknown[] | undefined;
  readonly scoreLaunches: unknown[] | undefined;
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
  const getCol = (name: string | undefined): unknown[] | undefined => {
    if (name === undefined) return undefined;
    const idx = colIndex.get(name);
    if (idx === undefined) return undefined;
    return frame.columns[idx] as unknown[] | undefined;
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

  const dateCol = cols.date;
  const roundCol = cols.round;
  const nRows = dateCol ? dateCol.length : 0;
  const hasFilters = options.season !== undefined || options.round !== undefined;

  // Build matching row indices, or iterate all rows when no filters are active
  let rowIndices: number[] | null = null;
  let rowCount = nRows;

  if (hasFilters) {
    const matching: number[] = [];
    for (let i = 0; i < nRows; i++) {
      if (options.season !== undefined) {
        const dateStr = dateCol?.[i];
        if (typeof dateStr !== "string") continue;
        const year = Number(dateStr.slice(0, 4));
        if (year !== options.season) continue;
      }

      if (options.round !== undefined && roundCol) {
        const roundVal = roundCol[i];
        const roundNum = typeof roundVal === "string" ? Number(roundVal) : roundVal;
        if (roundNum !== options.round) continue;
      }

      matching.push(i);
    }
    rowIndices = matching;
    rowCount = matching.length;
  }

  const stats: PlayerStats[] = new Array(rowCount);
  for (let j = 0; j < rowCount; j++) {
    // biome-ignore lint/style/noNonNullAssertion: bounded by rowCount
    const i = rowIndices ? rowIndices[j]! : j;
    stats[j] = mapRow(i, cols, isAflw, options.competition);
  }

  return ok(stats);
}

/** Extract a numeric value from a column at the given row index. */
function numAt(column: unknown[] | undefined, i: number): number | null {
  if (!column) return null;
  const v = column[i];
  return typeof v === "number" ? v : null;
}

/** Extract a string value from a column at the given row index. */
function strAt(column: unknown[] | undefined, i: number): string | null {
  if (!column) return null;
  const v = column[i];
  return typeof v === "string" ? v : null;
}

/** Parse round number, returning 0 for non-numeric values (e.g. "Semi Final"). */
function roundAt(column: unknown[] | undefined, i: number): number {
  if (!column) return 0;
  const v = column[i];
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isNaN(n) ? 0 : n;
  }
  return 0;
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
    matchId: String(c.matchId?.[i] ?? ""),
    season: dateStr ? Number(dateStr.slice(0, 4)) : 0,
    roundNumber: roundAt(c.round, i),
    team: normaliseTeamName(team),
    competition,
    date: dateStr ? new Date(dateStr) : null,
    homeTeam: homeTeam ? normaliseTeamName(homeTeam) : null,
    awayTeam: awayTeam ? normaliseTeamName(awayTeam) : null,

    playerId: String(c.playerId?.[i] ?? ""),
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
