-- Shared SQLite schema for AFL data comparison.
-- Used by both reference (AFL-MCP export) and fitzRoy-ts loaded databases.

CREATE TABLE IF NOT EXISTS competitions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL
);
INSERT OR IGNORE INTO competitions (code, name) VALUES ('AFLM', 'AFL Mens');

CREATE TABLE IF NOT EXISTS seasons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    competition_id INTEGER NOT NULL REFERENCES competitions(id),
    year INTEGER NOT NULL,
    UNIQUE (competition_id, year)
);

CREATE TABLE IF NOT EXISTS teams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    competition_id INTEGER NOT NULL REFERENCES competitions(id),
    UNIQUE (name, competition_id)
);

CREATE TABLE IF NOT EXISTS venues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT,
    surname TEXT NOT NULL,
    external_id TEXT,
    external_afl_player_id TEXT
);

CREATE TABLE IF NOT EXISTS matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    season_id INTEGER NOT NULL REFERENCES seasons(id),
    round TEXT NOT NULL,
    round_number INTEGER,
    round_type TEXT DEFAULT 'Regular',
    date TEXT NOT NULL,
    venue_id INTEGER REFERENCES venues(id),
    home_team_id INTEGER NOT NULL REFERENCES teams(id),
    away_team_id INTEGER NOT NULL REFERENCES teams(id),
    home_goals INTEGER,
    home_behinds INTEGER,
    home_points INTEGER,
    away_goals INTEGER,
    away_behinds INTEGER,
    away_points INTEGER,
    margin INTEGER,
    attendance INTEGER,
    external_afl_id TEXT,
    home_q1_goals INTEGER, home_q1_behinds INTEGER,
    home_q2_goals INTEGER, home_q2_behinds INTEGER,
    home_q3_goals INTEGER, home_q3_behinds INTEGER,
    home_q4_goals INTEGER, home_q4_behinds INTEGER,
    away_q1_goals INTEGER, away_q1_behinds INTEGER,
    away_q2_goals INTEGER, away_q2_behinds INTEGER,
    away_q3_goals INTEGER, away_q3_behinds INTEGER,
    away_q4_goals INTEGER, away_q4_behinds INTEGER,
    UNIQUE (date, home_team_id, away_team_id)
);

CREATE TABLE IF NOT EXISTS player_match_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_id INTEGER NOT NULL REFERENCES matches(id),
    player_id INTEGER NOT NULL REFERENCES players(id),
    team_id INTEGER NOT NULL REFERENCES teams(id),
    guernsey_number INTEGER,
    time_on_ground_pct REAL,
    kicks INTEGER,
    handballs INTEGER,
    disposals INTEGER,
    effective_disposals INTEGER,
    disposal_efficiency_pct REAL,
    marks INTEGER,
    bounces INTEGER,
    tackles INTEGER,
    one_percenters INTEGER,
    clangers INTEGER,
    contested_possessions INTEGER,
    uncontested_possessions INTEGER,
    total_possessions INTEGER,
    goals INTEGER,
    behinds INTEGER,
    goal_assists INTEGER,
    shots_at_goal INTEGER,
    score_involvements INTEGER,
    score_launches INTEGER,
    centre_clearances INTEGER,
    stoppage_clearances INTEGER,
    clearances INTEGER,
    contested_marks INTEGER,
    marks_inside_fifty INTEGER,
    intercept_marks INTEGER,
    marks_on_lead INTEGER,
    free_kicks_for INTEGER,
    free_kicks_against INTEGER,
    hitouts INTEGER,
    hitouts_to_advantage INTEGER,
    hitout_win_pct REAL,
    ruck_contests INTEGER,
    inside_fifties INTEGER,
    rebounds INTEGER,
    turnovers INTEGER,
    intercepts INTEGER,
    metres_gained INTEGER,
    pressure_acts INTEGER,
    def_half_pressure_acts INTEGER,
    tackles_inside_fifty INTEGER,
    spoils INTEGER,
    contest_def_losses INTEGER,
    contest_def_one_on_ones INTEGER,
    contest_off_one_on_ones INTEGER,
    contest_off_wins INTEGER,
    effective_kicks INTEGER,
    ground_ball_gets INTEGER,
    f50_ground_ball_gets INTEGER,
    rating_points REAL,
    afl_fantasy_score INTEGER,
    goal_accuracy REAL,
    kick_efficiency REAL,
    kick_to_handball_ratio REAL,
    contested_possession_rate REAL,
    contest_def_loss_pct REAL,
    contest_off_wins_pct REAL,
    centre_bounce_attendances INTEGER,
    kickins INTEGER,
    kickins_playon INTEGER,
    UNIQUE (match_id, player_id)
);
