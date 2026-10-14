/** Pure validation for CLI commands that select a mode from flag combinations. */

import { Result } from "effect";
import type { AwardType, SeasonSelector } from "../types";
import { type GroupBy, usage, type Validated } from "./validation";

/** Mode selected by the `team` command. */
export type TeamCommandMode = "list" | "squad" | "lineup";

interface StatsModeArgs {
  readonly groupBy: GroupBy;
  readonly round?: number | undefined;
  readonly match?: string | undefined;
  readonly matchId?: string | undefined;
  readonly player?: string | undefined;
  readonly summary?: string | undefined;
}

/** Validate flags that apply differently to player and team statistics. */
export function validateStatsMode(args: StatsModeArgs): Validated<void> {
  if (args.match !== undefined && args.matchId !== undefined) {
    return usage("Use only one of --match and --id.");
  }

  if (args.groupBy === "player") {
    if (args.summary !== undefined) {
      return usage("--summary is only supported with --by team.");
    }

    return Result.void;
  }

  const invalid = [
    args.round !== undefined ? "--round" : undefined,
    args.match !== undefined ? "--match" : undefined,
    args.matchId !== undefined ? "--id" : undefined,
    args.player !== undefined ? "--player" : undefined,
  ].filter((flag): flag is string => flag !== undefined);

  if (invalid.length > 0) {
    return usage(
      `${invalid.join(", ")} ${invalid.length === 1 ? "is" : "are"} not supported with --by team. Team stats are season-level rows.`,
    );
  }

  return Result.void;
}

interface TeamModeArgs {
  readonly season?: SeasonSelector | undefined;
  readonly round?: number | undefined;
  readonly name?: string | undefined;
  readonly team?: string | undefined;
  readonly match?: string | undefined;
  readonly matchId?: string | undefined;
}

/** Validate the `team` flag combination and return its selected mode. */
export function validateTeamMode(args: TeamModeArgs): Validated<TeamCommandMode> {
  if (args.name !== undefined && args.team !== undefined) {
    return usage("Use only one of --name and --team.");
  }

  if (args.match !== undefined && args.matchId !== undefined) {
    return usage("Use only one of --match and --match-id.");
  }

  if (args.round !== undefined && args.season === undefined) {
    return usage("--round requires --season for lineup mode.");
  }

  if ((args.match !== undefined || args.matchId !== undefined) && args.round === undefined) {
    return usage("--match and --match-id require --season and --round for lineup mode.");
  }

  if (args.season !== undefined && args.round !== undefined) return Result.succeed("lineup");

  const teamName = args.name ?? args.team;

  if (args.season !== undefined) {
    if (teamName === undefined) {
      return usage(
        "--season requires --name or --team for squad mode, or --round for lineup mode.",
      );
    }

    return Result.succeed("squad");
  }

  return Result.succeed("list");
}

/** Reject round-scoped requests for season-only awards. */
export function validateAwardsMode(award: AwardType, round: number | undefined): Validated<void> {
  if (round !== undefined && award !== "coaches") {
    return usage(
      `--round is not supported for --type ${award}. Round-scoped data is only available for coaches votes.`,
    );
  }

  return Result.void;
}
