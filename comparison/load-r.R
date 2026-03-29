#!/usr/bin/env Rscript
#
# Fetch 2024-2025 AFLM data via the fitzRoy R package and load into SQLite.
#
# Usage: Rscript comparison/load-r.R
#
# Produces: comparison/reference.db

library(fitzRoy)
library(RSQLite)
library(DBI)

SEASONS <- c(2024, 2025)
SCRIPT_DIR <- tryCatch(
  dirname(sys.frame(1)$ofile),
  error = function(e) {
    # Fallback: use commandArgs to find script path
    args <- commandArgs(trailingOnly = FALSE)
    file_arg <- grep("^--file=", args, value = TRUE)
    if (length(file_arg) > 0) {
      dirname(sub("^--file=", "", file_arg[1]))
    } else {
      "comparison"
    }
  }
)
DB_PATH <- file.path(SCRIPT_DIR, "reference.db")
SCHEMA_PATH <- file.path(SCRIPT_DIR, "schema.sql")

# ---- helpers ----------------------------------------------------------------

extract_quarter <- function(period_scores, quarter) {
  if (is.null(period_scores) || length(period_scores) == 0) return(list(goals = NA, behinds = NA))
  row <- period_scores[period_scores$periodNumber == quarter, ]
  if (nrow(row) == 0) return(list(goals = NA, behinds = NA))
  list(goals = row$score.goals[1], behinds = row$score.behinds[1])
}

ensure_team <- function(con, name, comp_id) {
  existing <- dbGetQuery(con, "SELECT id FROM teams WHERE name = ? AND competition_id = ?",
                         params = list(name, comp_id))
  if (nrow(existing) > 0) return(existing$id[1])
  dbExecute(con, "INSERT INTO teams (name, competition_id) VALUES (?, ?)",
            params = list(name, comp_id))
  dbGetQuery(con, "SELECT last_insert_rowid() as id")$id[1]
}

ensure_venue <- function(con, name) {
  if (is.na(name) || name == "") return(NA)
  existing <- dbGetQuery(con, "SELECT id FROM venues WHERE name = ?", params = list(name))
  if (nrow(existing) > 0) return(existing$id[1])
  dbExecute(con, "INSERT INTO venues (name) VALUES (?)", params = list(name))
  dbGetQuery(con, "SELECT last_insert_rowid() as id")$id[1]
}

ensure_player <- function(con, first_name, surname, afl_player_id) {
  existing <- dbGetQuery(con, "SELECT id FROM players WHERE external_afl_player_id = ?",
                         params = list(afl_player_id))
  if (nrow(existing) > 0) return(existing$id[1])
  dbExecute(con, "INSERT INTO players (first_name, surname, external_afl_player_id) VALUES (?, ?, ?)",
            params = list(first_name, surname, afl_player_id))
  dbGetQuery(con, "SELECT last_insert_rowid() as id")$id[1]
}

safe_val <- function(x) {
  if (is.null(x) || length(x) == 0 || is.na(x)) return(NA)
  x
}

to_aest_date <- function(utc_str) {
  # Parse UTC time and convert to AEST date string
  utc <- as.POSIXct(utc_str, format = "%Y-%m-%dT%H:%M:%S", tz = "UTC")
  if (is.na(utc)) {
    utc <- as.POSIXct(utc_str, tz = "UTC")
  }
  aest <- format(utc, tz = "Australia/Melbourne", format = "%Y-%m-%d")
  aest
}

# ---- main -------------------------------------------------------------------

cat("=== fitzRoy R: Loading data into SQLite ===\n\n")

# Clean up and create DB
if (file.exists(DB_PATH)) file.remove(DB_PATH)
con <- dbConnect(RSQLite::SQLite(), DB_PATH)
dbExecute(con, "PRAGMA journal_mode = WAL")
dbExecute(con, "PRAGMA foreign_keys = ON")

# Apply schema
schema <- readLines(SCHEMA_PATH, warn = FALSE)
schema_sql <- paste(schema, collapse = "\n")
# Execute each statement separately (RSQLite doesn't support multi-statement)
statements <- strsplit(schema_sql, ";")[[1]]
for (stmt in statements) {
  stmt <- trimws(stmt)
  if (nchar(stmt) > 0) {
    tryCatch(dbExecute(con, paste0(stmt, ";")), error = function(e) NULL)
  }
}

comp_id <- 1  # seeded by schema

for (season_year in SEASONS) {
  cat(sprintf("\n--- Season %d ---\n", season_year))

  # Create season
  dbExecute(con, "INSERT INTO seasons (competition_id, year) VALUES (?, ?)",
            params = list(comp_id, season_year))
  season_id <- dbGetQuery(con, "SELECT id FROM seasons WHERE year = ?",
                          params = list(season_year))$id[1]

  # 1. Fetch match results
  cat("Fetching match results...\n")
  matches <- tryCatch(
    fetch_results(season = season_year, source = "AFL", comp = "AFLM"),
    error = function(e) { cat(sprintf("  ERROR: %s\n", e$message)); NULL }
  )
  if (is.null(matches)) next
  cat(sprintf("  Got %d matches\n", nrow(matches)))

  # 2. Insert matches
  match_id_map <- list()  # API matchId -> SQLite id

  for (i in seq_len(nrow(matches))) {
    m <- matches[i, ]

    home_team <- m$match.homeTeam.name
    away_team <- m$match.awayTeam.name
    venue_name <- safe_val(m$venue.name)

    home_team_id <- ensure_team(con, home_team, comp_id)
    away_team_id <- ensure_team(con, away_team, comp_id)
    venue_id <- ensure_venue(con, venue_name)

    date_str <- to_aest_date(m$match.utcStartTime)
    round_num <- safe_val(m$round.roundNumber)
    round_name <- safe_val(m$round.name)
    round_type <- ifelse(grepl("final|elimination|qualifying|preliminary|semi|grand",
                               tolower(round_name)), "Finals", "Regular")
    round_label <- ifelse(round_type == "Finals", round_name, paste0("R", round_num))

    # Quarter scores
    h_ps <- m$homeTeamScore.periodScore[[1]]
    a_ps <- m$awayTeamScore.periodScore[[1]]
    hq1 <- extract_quarter(h_ps, 1); hq2 <- extract_quarter(h_ps, 2)
    hq3 <- extract_quarter(h_ps, 3); hq4 <- extract_quarter(h_ps, 4)
    aq1 <- extract_quarter(a_ps, 1); aq2 <- extract_quarter(a_ps, 2)
    aq3 <- extract_quarter(a_ps, 3); aq4 <- extract_quarter(a_ps, 4)

    home_pts <- safe_val(m$homeTeamScore.matchScore.totalScore)
    away_pts <- safe_val(m$awayTeamScore.matchScore.totalScore)
    margin <- ifelse(is.na(home_pts) | is.na(away_pts), NA, home_pts - away_pts)

    dbExecute(con, "INSERT OR IGNORE INTO matches (
      season_id, round, round_number, round_type, date,
      venue_id, home_team_id, away_team_id,
      home_goals, home_behinds, home_points,
      away_goals, away_behinds, away_points,
      margin, attendance, external_afl_id,
      home_q1_goals, home_q1_behinds, home_q2_goals, home_q2_behinds,
      home_q3_goals, home_q3_behinds, home_q4_goals, home_q4_behinds,
      away_q1_goals, away_q1_behinds, away_q2_goals, away_q2_behinds,
      away_q3_goals, away_q3_behinds, away_q4_goals, away_q4_behinds
    ) VALUES (?,?,?,?,?, ?,?,?, ?,?,?, ?,?,?, ?,?,?, ?,?,?,?, ?,?,?,?, ?,?,?,?, ?,?,?,?)",
    params = list(
      season_id, round_label, round_num, round_type, date_str,
      venue_id, home_team_id, away_team_id,
      safe_val(m$homeTeamScore.matchScore.goals),
      safe_val(m$homeTeamScore.matchScore.behinds),
      home_pts,
      safe_val(m$awayTeamScore.matchScore.goals),
      safe_val(m$awayTeamScore.matchScore.behinds),
      away_pts,
      margin, NA, safe_val(m$match.matchId),
      hq1$goals, hq1$behinds, hq2$goals, hq2$behinds,
      hq3$goals, hq3$behinds, hq4$goals, hq4$behinds,
      aq1$goals, aq1$behinds, aq2$goals, aq2$behinds,
      aq3$goals, aq3$behinds, aq4$goals, aq4$behinds
    ))

    # Get the inserted match's SQLite ID
    sqlite_match_id <- dbGetQuery(con,
      "SELECT id FROM matches WHERE date = ? AND home_team_id = ? AND away_team_id = ?",
      params = list(date_str, home_team_id, away_team_id))$id[1]
    match_id_map[[m$match.matchId]] <- sqlite_match_id
  }
  cat(sprintf("  Inserted %d matches\n", length(match_id_map)))

  # 3. Fetch player stats round by round
  total_stats <- 0
  max_round <- 30

  for (rnd in 0:max_round) {
    stats <- tryCatch(
      fetch_player_stats(season = season_year, round_number = rnd, source = "AFL", comp = "AFLM"),
      error = function(e) NULL
    )
    if (is.null(stats) || nrow(stats) == 0) next

    for (j in seq_len(nrow(stats))) {
      s <- stats[j, ]

      player_id_api <- safe_val(s$player.player.player.playerId)
      if (is.na(player_id_api)) next

      first_name <- safe_val(s$player.player.player.givenName)
      surname <- safe_val(s$player.player.player.surname)
      team_name <- safe_val(s$team.name)

      player_id <- ensure_player(con, first_name, surname, player_id_api)
      team_id <- ensure_team(con, team_name, comp_id)

      # Find the match
      match_api_id <- safe_val(s$providerId)
      sqlite_match_id <- match_id_map[[match_api_id]]
      if (is.null(sqlite_match_id)) next

      dbExecute(con, "INSERT OR IGNORE INTO player_match_stats (
        match_id, player_id, team_id,
        guernsey_number, time_on_ground_pct,
        kicks, handballs, disposals, effective_disposals, disposal_efficiency_pct,
        marks, bounces, tackles, one_percenters, clangers,
        contested_possessions, uncontested_possessions, total_possessions,
        goals, behinds, goal_assists, shots_at_goal, score_involvements, score_launches,
        centre_clearances, stoppage_clearances, clearances,
        contested_marks, marks_inside_fifty, intercept_marks, marks_on_lead,
        free_kicks_for, free_kicks_against,
        hitouts, hitouts_to_advantage, hitout_win_pct, ruck_contests,
        inside_fifties, rebounds, turnovers, intercepts, metres_gained,
        pressure_acts, def_half_pressure_acts, tackles_inside_fifty, spoils,
        contest_def_losses, contest_def_one_on_ones, contest_off_one_on_ones, contest_off_wins,
        effective_kicks, ground_ball_gets, f50_ground_ball_gets,
        rating_points, afl_fantasy_score,
        goal_accuracy, kick_efficiency, kick_to_handball_ratio,
        contested_possession_rate, contest_def_loss_pct, contest_off_wins_pct,
        centre_bounce_attendances, kickins, kickins_playon
      ) VALUES (?,?,?, ?,?, ?,?,?,?,?, ?,?,?,?,?, ?,?,?, ?,?,?,?,?,?, ?,?,?, ?,?,?,?, ?,?, ?,?,?,?, ?,?,?,?,?, ?,?,?,?, ?,?,?,?, ?,?,?, ?,?, ?,?,?, ?,?,?, ?,?,?)",
      params = list(
        sqlite_match_id, player_id, team_id,
        safe_val(s$player.jumperNumber),
        safe_val(s$timeOnGroundPercentage),
        safe_val(s$kicks), safe_val(s$handballs), safe_val(s$disposals),
        safe_val(s$extendedStats.effectiveDisposals),
        safe_val(s$disposalEfficiency),
        safe_val(s$marks), safe_val(s$bounces), safe_val(s$tackles),
        safe_val(s$onePercenters), safe_val(s$clangers),
        safe_val(s$contestedPossessions), safe_val(s$uncontestedPossessions),
        safe_val(s$totalPossessions),
        safe_val(s$goals), safe_val(s$behinds), safe_val(s$goalAssists),
        safe_val(s$shotsAtGoal), safe_val(s$scoreInvolvements),
        safe_val(s$extendedStats.scoreLaunches),
        safe_val(s$clearances.centreClearances),
        safe_val(s$clearances.stoppageClearances),
        safe_val(s$clearances.totalClearances),
        safe_val(s$contestedMarks), safe_val(s$marksInside50),
        safe_val(s$extendedStats.interceptMarks),
        safe_val(s$extendedStats.marksOnLead),
        safe_val(s$freesFor), safe_val(s$freesAgainst),
        safe_val(s$hitouts),
        safe_val(s$extendedStats.hitoutsToAdvantage),
        safe_val(s$extendedStats.hitoutWinPercentage),
        safe_val(s$extendedStats.ruckContests),
        safe_val(s$inside50s), safe_val(s$rebound50s),
        safe_val(s$turnovers), safe_val(s$intercepts),
        safe_val(s$metresGained),
        safe_val(s$extendedStats.pressureActs),
        safe_val(s$extendedStats.defHalfPressureActs),
        safe_val(s$tacklesInside50),
        safe_val(s$extendedStats.spoils),
        safe_val(s$extendedStats.contestDefLosses),
        safe_val(s$extendedStats.contestDefOneOnOnes),
        safe_val(s$extendedStats.contestOffOneOnOnes),
        safe_val(s$extendedStats.contestOffWins),
        safe_val(s$extendedStats.effectiveKicks),
        safe_val(s$extendedStats.groundBallGets),
        safe_val(s$extendedStats.f50GroundBallGets),
        safe_val(s$ratingPoints), safe_val(s$dreamTeamPoints),
        safe_val(s$goalAccuracy),
        safe_val(s$extendedStats.kickEfficiency),
        safe_val(s$extendedStats.kickToHandballRatio),
        safe_val(s$extendedStats.contestedPossessionRate),
        safe_val(s$extendedStats.contestDefLossPercentage),
        safe_val(s$extendedStats.contestOffWinsPercentage),
        safe_val(s$extendedStats.centreBounceAttendances),
        safe_val(s$extendedStats.kickins),
        safe_val(s$extendedStats.kickinsPlayon)
      ))
      total_stats <- total_stats + 1
    }
    cat(sprintf("\r  Round %d: %d stats (total: %d)", rnd, nrow(stats), total_stats))
  }

  cat(sprintf("\n  Total player stats: %d\n", total_stats))
}

# Summary
match_count <- dbGetQuery(con, "SELECT COUNT(*) as c FROM matches")$c
stat_count <- dbGetQuery(con, "SELECT COUNT(*) as c FROM player_match_stats")$c
player_count <- dbGetQuery(con, "SELECT COUNT(DISTINCT player_id) as c FROM player_match_stats")$c
team_count <- dbGetQuery(con, "SELECT COUNT(*) as c FROM teams")$c

cat(sprintf("\n=== Summary ===\n"))
cat(sprintf("Matches: %d\n", match_count))
cat(sprintf("Player stats: %d\n", stat_count))
cat(sprintf("Players: %d\n", player_count))
cat(sprintf("Teams: %d\n", team_count))
cat(sprintf("\nReference DB: %s\n", DB_PATH))

dbDisconnect(con)
