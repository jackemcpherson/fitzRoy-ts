library(fitzRoy)
library(jsonlite)

outdir <- "comparison/r"
dir.create(outdir, recursive = TRUE, showWarnings = FALSE)

safe_dump <- function(id, expr, file) {
  cat(sprintf("[%s] Running... ", id))
  tryCatch(
    {
      result <- eval(expr)
      write(toJSON(result, pretty = TRUE, auto_unbox = TRUE, Date = "ISO8601", POSIXt = "ISO8601"),
            file.path(outdir, file))
      cat(sprintf("OK (%d rows)\n", nrow(result)))
    },
    error = function(e) {
      cat(sprintf("ERROR: %s\n", e$message))
      write(toJSON(list(error = e$message), pretty = TRUE, auto_unbox = TRUE),
            file.path(outdir, file))
    }
  )
}

# A1: Match results, AFL API, 2024, Round 1
safe_dump("A1", quote(fetch_results(season = 2024, round_number = 1, source = "AFL", comp = "AFLM")),
          "match-results-afl-r1.json")

# A2: Match results, AFL API, 2024, full season
safe_dump("A2", quote(fetch_results(season = 2024, source = "AFL", comp = "AFLM")),
          "match-results-afl-full.json")

# A3: Match results, AFL Tables, 2024
safe_dump("A3", quote(fetch_results(season = 2024, source = "afltables")),
          "match-results-afltables.json")

# A4: Match results, FootyWire, 2024
safe_dump("A4", quote(fetch_results(season = 2024, source = "footywire")),
          "match-results-footywire.json")

# A5: Match results, AFL API, 2024, Round 25 (finals)
safe_dump("A5", quote(fetch_results(season = 2024, round_number = 25, source = "AFL", comp = "AFLM")),
          "match-results-afl-finals.json")

# A6: Match results, AFL Tables, 2000 (historical)
safe_dump("A6", quote(fetch_results(season = 2000, source = "afltables")),
          "match-results-afltables-2000.json")

# B1: Player stats, AFL API, 2024, Round 1
safe_dump("B1", quote(fetch_player_stats(season = 2024, round_number = 1, source = "AFL", comp = "AFLM")),
          "player-stats-afl-r1.json")

# B2: Player stats, AFL API, 2024, Round 25 (finals)
safe_dump("B2", quote(fetch_player_stats(season = 2024, round_number = 25, source = "AFL", comp = "AFLM")),
          "player-stats-afl-finals.json")

# C1: Fixture, AFL API, 2024, Round 1
safe_dump("C1", quote(fetch_fixture(season = 2024, round_number = 1, source = "AFL", comp = "AFLM")),
          "fixture-afl-r1.json")

# C2: Fixture, AFL API, 2024, full season
safe_dump("C2", quote(fetch_fixture(season = 2024, source = "AFL", comp = "AFLM")),
          "fixture-afl-full.json")

# D1: Lineup, AFL API, 2024, Round 1
safe_dump("D1", quote(fetch_lineup(season = 2024, round_number = 1, source = "AFL", comp = "AFLM")),
          "lineup-afl-r1.json")

# E1: Ladder, AFL API, 2024, Round 10
safe_dump("E1", quote(fetch_ladder(season = 2024, round_number = 10, source = "AFL", comp = "AFLM")),
          "ladder-afl-r10.json")

# F1: Squad / player details, Carlton, 2024
safe_dump("F1", quote(fetch_player_details(season = 2024, team = "Carlton", source = "AFL", comp = "AFLM")),
          "squad-carlton.json")

cat("\nDone! All outputs in comparison/r/\n")
