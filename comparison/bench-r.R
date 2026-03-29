library(fitzRoy)

bench <- function(label, expr) {
  cat(sprintf("%-45s", label))
  start <- proc.time()
  result <- tryCatch(eval(expr), error = function(e) NULL)
  elapsed <- (proc.time() - start)["elapsed"]
  rows <- if (!is.null(result)) nrow(result) else 0
  cat(sprintf("%6.2fs  (%d rows)\n", elapsed, rows))
}

cat("=== fitzRoy R Performance ===\n\n")

bench("fetch_results(2024, Rd 1, AFL)",
  quote(fetch_results(2024, round_number = 1, source = "AFL", comp = "AFLM")))

bench("fetch_results(2024, full season, AFL)",
  quote(fetch_results(2024, source = "AFL", comp = "AFLM")))

bench("fetch_results(2024, afltables)",
  quote(fetch_results(2024, source = "afltables")))

bench("fetch_player_stats(2024, Rd 1, AFL)",
  quote(fetch_player_stats(2024, round_number = 1, source = "AFL", comp = "AFLM")))

bench("fetch_fixture(2024, Rd 1, AFL)",
  quote(fetch_fixture(2024, round_number = 1, source = "AFL", comp = "AFLM")))

bench("fetch_ladder(2024, Rd 10, AFL)",
  quote(fetch_ladder(2024, round_number = 10, source = "AFL", comp = "AFLM")))

bench("fetch_lineup(2024, Rd 1, AFL)",
  quote(fetch_lineup(2024, round_number = 1, source = "AFL", comp = "AFLM")))

bench("fetch_player_details(2024, Carlton, AFL)",
  quote(fetch_player_details(2024, team = "Carlton", source = "AFL", comp = "AFLM")))

cat("\nDone.\n")
