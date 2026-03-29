/**
 * Fetch 2024-2025 AFLM data via fitzRoy-ts library and load into SQLite.
 *
 * Usage: bun run comparison/load-ts.ts
 *
 * Produces: comparison/fitzroy.db
 */
import { Database } from "bun:sqlite";
import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";

import { fetchMatchResults, fetchPlayerStats } from "../src/index";
import type { MatchResult, PlayerStats } from "../src/types";

const DB_PATH = join(import.meta.dir, "fitzroy.db");
const SCHEMA_PATH = join(import.meta.dir, "schema.sql");
const SEASONS = [2024, 2025];
const MAX_ROUND = 30;

// ---- setup -----------------------------------------------------------------

if (existsSync(DB_PATH)) unlinkSync(DB_PATH);
const db = new Database(DB_PATH);
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");
db.exec(readFileSync(SCHEMA_PATH, "utf-8"));

// ---- prepared statements ---------------------------------------------------

const insertSeason = db.prepare(
  "INSERT INTO seasons (competition_id, year) VALUES (1, ?) RETURNING id",
);
const insertTeam = db.prepare("INSERT OR IGNORE INTO teams (name, competition_id) VALUES (?, 1)");
const getTeam = db.prepare("SELECT id FROM teams WHERE name = ? AND competition_id = 1");
const insertVenue = db.prepare("INSERT OR IGNORE INTO venues (name) VALUES (?)");
const getVenue = db.prepare("SELECT id FROM venues WHERE name = ?");
const insertMatch = db.prepare(`
  INSERT OR IGNORE INTO matches (
    season_id, round, round_number, round_type, date,
    venue_id, home_team_id, away_team_id,
    home_goals, home_behinds, home_points,
    away_goals, away_behinds, away_points,
    margin, attendance, external_afl_id,
    home_q1_goals, home_q1_behinds, home_q2_goals, home_q2_behinds,
    home_q3_goals, home_q3_behinds, home_q4_goals, home_q4_behinds,
    away_q1_goals, away_q1_behinds, away_q2_goals, away_q2_behinds,
    away_q3_goals, away_q3_behinds, away_q4_goals, away_q4_behinds
  ) VALUES (${Array(33).fill("?").join(",")})
`);
const getMatch = db.prepare(
  "SELECT id FROM matches WHERE date = ? AND home_team_id = ? AND away_team_id = ?",
);
const insertPlayer = db.prepare(
  "INSERT OR IGNORE INTO players (first_name, surname, external_afl_player_id) VALUES (?, ?, ?)",
);
const getPlayer = db.prepare("SELECT id FROM players WHERE external_afl_player_id = ?");

const STAT_COLUMNS = [
  "guernsey_number",
  "time_on_ground_pct",
  "kicks",
  "handballs",
  "disposals",
  "effective_disposals",
  "disposal_efficiency_pct",
  "marks",
  "bounces",
  "tackles",
  "one_percenters",
  "clangers",
  "contested_possessions",
  "uncontested_possessions",
  "total_possessions",
  "goals",
  "behinds",
  "goal_assists",
  "shots_at_goal",
  "score_involvements",
  "score_launches",
  "centre_clearances",
  "stoppage_clearances",
  "clearances",
  "contested_marks",
  "marks_inside_fifty",
  "intercept_marks",
  "marks_on_lead",
  "free_kicks_for",
  "free_kicks_against",
  "hitouts",
  "hitouts_to_advantage",
  "hitout_win_pct",
  "ruck_contests",
  "inside_fifties",
  "rebounds",
  "turnovers",
  "intercepts",
  "metres_gained",
  "pressure_acts",
  "def_half_pressure_acts",
  "tackles_inside_fifty",
  "spoils",
  "contest_def_losses",
  "contest_def_one_on_ones",
  "contest_off_one_on_ones",
  "contest_off_wins",
  "effective_kicks",
  "ground_ball_gets",
  "f50_ground_ball_gets",
  "rating_points",
  "afl_fantasy_score",
  "goal_accuracy",
  "kick_efficiency",
  "kick_to_handball_ratio",
  "contested_possession_rate",
  "contest_def_loss_pct",
  "contest_off_wins_pct",
  "centre_bounce_attendances",
  "kickins",
  "kickins_playon",
];

const insertStat = db.prepare(`
  INSERT OR IGNORE INTO player_match_stats (
    match_id, player_id, team_id, ${STAT_COLUMNS.join(", ")}
  ) VALUES (${Array(3 + STAT_COLUMNS.length)
    .fill("?")
    .join(",")})
`);

// ---- helpers ---------------------------------------------------------------

function formatDate(d: Date): string {
  const aest = new Date(d.getTime() + 10 * 60 * 60 * 1000);
  const [dateStr] = aest.toISOString().split("T");
  return dateStr ?? aest.toISOString().slice(0, 10);
}

function ensureTeam(name: string): number {
  insertTeam.run(name);
  return (getTeam.get(name) as { id: number }).id;
}

function ensureVenue(name: string): number {
  insertVenue.run(name);
  return (getVenue.get(name) as { id: number }).id;
}

function ensurePlayer(firstName: string, surname: string, aflPlayerId: string): number {
  insertPlayer.run(firstName, surname, aflPlayerId);
  return (getPlayer.get(aflPlayerId) as { id: number }).id;
}

function mapStatValues(s: PlayerStats): (number | null)[] {
  return [
    s.jumperNumber,
    s.timeOnGroundPercentage,
    s.kicks,
    s.handballs,
    s.disposals,
    s.effectiveDisposals,
    s.disposalEfficiency,
    s.marks,
    s.bounces,
    s.tackles,
    s.onePercenters,
    s.clangers,
    s.contestedPossessions,
    s.uncontestedPossessions,
    s.totalPossessions,
    s.goals,
    s.behinds,
    s.goalAssists,
    s.shotsAtGoal,
    s.scoreInvolvements,
    s.scoreLaunches,
    s.centreClearances,
    s.stoppageClearances,
    s.totalClearances,
    s.contestedMarks,
    s.marksInside50,
    s.interceptMarks,
    s.marksOnLead,
    s.freesFor,
    s.freesAgainst,
    s.hitouts,
    s.hitoutsToAdvantage,
    s.hitoutWinPercentage,
    s.ruckContests,
    s.inside50s,
    s.rebound50s,
    s.turnovers,
    s.intercepts,
    s.metresGained,
    s.pressureActs,
    s.defHalfPressureActs,
    s.tacklesInside50,
    s.spoils,
    s.contestDefLosses,
    s.contestDefOneOnOnes,
    s.contestOffOneOnOnes,
    s.contestOffWins,
    s.effectiveKicks,
    s.groundBallGets,
    s.f50GroundBallGets,
    s.ratingPoints,
    s.dreamTeamPoints,
    s.goalAccuracy,
    s.kickEfficiency,
    s.kickToHandballRatio,
    s.contestedPossessionRate,
    s.contestDefLossPercentage,
    s.contestOffWinsPercentage,
    s.centreBounceAttendances,
    s.kickins,
    s.kickinsPlayon,
  ];
}

// ---- load ------------------------------------------------------------------

async function loadSeason(seasonYear: number, seasonId: number) {
  console.log(`\n--- Season ${seasonYear} ---`);

  console.log("Fetching match results...");
  const matchResult = await fetchMatchResults({
    source: "afl-api",
    season: seasonYear,
    competition: "AFLM",
  });
  if (!matchResult.success) {
    console.error(`  ERROR: ${matchResult.error.message}`);
    return;
  }

  const matches = matchResult.data;
  console.log(`  Got ${matches.length} matches`);

  const matchIdMap = new Map<string, number>();

  const insertMatches = db.transaction((matchList: MatchResult[]) => {
    for (const m of matchList) {
      const venueId = m.venue ? ensureVenue(m.venue) : null;
      const homeTeamId = ensureTeam(m.homeTeam);
      const awayTeamId = ensureTeam(m.awayTeam);
      const dateStr = formatDate(m.date);
      const roundType = m.roundType === "Finals" ? "Finals" : "Regular";
      const roundLabel = roundType === "Finals" ? `R${m.roundNumber}` : `R${m.roundNumber}`;

      insertMatch.run(
        seasonId,
        roundLabel,
        m.roundNumber,
        roundType,
        dateStr,
        venueId,
        homeTeamId,
        awayTeamId,
        m.homeGoals,
        m.homeBehinds,
        m.homePoints,
        m.awayGoals,
        m.awayBehinds,
        m.awayPoints,
        m.margin,
        m.attendance,
        m.matchId,
        m.q1Home?.goals ?? null,
        m.q1Home?.behinds ?? null,
        m.q2Home?.goals ?? null,
        m.q2Home?.behinds ?? null,
        m.q3Home?.goals ?? null,
        m.q3Home?.behinds ?? null,
        m.q4Home?.goals ?? null,
        m.q4Home?.behinds ?? null,
        m.q1Away?.goals ?? null,
        m.q1Away?.behinds ?? null,
        m.q2Away?.goals ?? null,
        m.q2Away?.behinds ?? null,
        m.q3Away?.goals ?? null,
        m.q3Away?.behinds ?? null,
        m.q4Away?.goals ?? null,
        m.q4Away?.behinds ?? null,
      );

      const row = getMatch.get(dateStr, homeTeamId, awayTeamId) as { id: number } | null;
      if (row) matchIdMap.set(m.matchId, row.id);
    }
  });
  insertMatches(matches);
  console.log(`  Inserted ${matchIdMap.size} matches`);

  let totalStats = 0;
  for (let round = 0; round <= MAX_ROUND; round++) {
    const statsResult = await fetchPlayerStats({
      source: "afl-api",
      season: seasonYear,
      round,
      competition: "AFLM",
    });
    if (!statsResult.success || statsResult.data.length === 0) continue;

    const stats = statsResult.data;
    const insertStats = db.transaction((statsList: PlayerStats[]) => {
      for (const s of statsList) {
        const sqliteMatchId = matchIdMap.get(s.matchId);
        if (!sqliteMatchId) continue;
        const teamId = ensureTeam(s.team);
        const playerId = ensurePlayer(s.givenName, s.surname, s.playerId);
        insertStat.run(sqliteMatchId, playerId, teamId, ...mapStatValues(s));
        totalStats++;
      }
    });
    insertStats(stats);
    process.stdout.write(`\r  Round ${round}: ${stats.length} stats (total: ${totalStats})`);
  }
  console.log(`\n  Total player stats: ${totalStats}`);
}

async function run() {
  console.log("=== fitzRoy-ts: Loading data into SQLite ===\n");

  for (const year of SEASONS) {
    const row = insertSeason.get(year) as { id: number };
    await loadSeason(year, row.id);
  }

  const matchCount = (db.prepare("SELECT COUNT(*) as c FROM matches").get() as { c: number }).c;
  const statCount = (
    db.prepare("SELECT COUNT(*) as c FROM player_match_stats").get() as { c: number }
  ).c;
  const playerCount = (
    db.prepare("SELECT COUNT(DISTINCT player_id) as c FROM player_match_stats").get() as {
      c: number;
    }
  ).c;
  const teamCount = (db.prepare("SELECT COUNT(*) as c FROM teams").get() as { c: number }).c;

  console.log(`\n=== Summary ===`);
  console.log(`Matches: ${matchCount}`);
  console.log(`Player stats: ${statCount}`);
  console.log(`Players: ${playerCount}`);
  console.log(`Teams: ${teamCount}`);
  console.log(`\nfitzRoy DB: ${DB_PATH}`);

  db.close();
}

run().catch((err) => {
  console.error(err);
  db.close();
  process.exit(1);
});
