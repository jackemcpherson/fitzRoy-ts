/** Pure validation for CLI commands that select a mode from flag combinations. */

import type { AwardType } from "../types";
import type { GroupBy } from "./validation";

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
export function validateStatsMode(args: StatsModeArgs): void {
  if (args.match !== undefined && args.matchId !== undefined) {
    throw new Error("Use only one of --match and --id.");
  }
  if (args.groupBy === "player") {
    if (args.summary !== undefined) {
      throw new Error("--summary is only supported with --by team.");
    }
    return;
  }

  const invalid = [
    args.round !== undefined ? "--round" : undefined,
    args.match !== undefined ? "--match" : undefined,
    args.matchId !== undefined ? "--id" : undefined,
    args.player !== undefined ? "--player" : undefined,
  ].filter((flag): flag is string => flag !== undefined);
  if (invalid.length > 0) {
    throw new Error(
      `${invalid.join(", ")} ${invalid.length === 1 ? "is" : "are"} not supported with --by team. Team stats are season-level rows.`,
    );
  }
}

interface TeamModeArgs {
  readonly season?: number | undefined;
  readonly round?: number | undefined;
  readonly name?: string | undefined;
  readonly team?: string | undefined;
  readonly match?: string | undefined;
  readonly matchId?: string | undefined;
}

/** Validate the `team` flag combination and return its selected mode. */
export function validateTeamMode(args: TeamModeArgs): TeamCommandMode {
  if (args.name !== undefined && args.team !== undefined) {
    throw new Error("Use only one of --name and --team.");
  }
  if (args.match !== undefined && args.matchId !== undefined) {
    throw new Error("Use only one of --match and --match-id.");
  }
  if (args.round !== undefined && args.season === undefined) {
    throw new Error("--round requires --season for lineup mode.");
  }
  if ((args.match !== undefined || args.matchId !== undefined) && args.round === undefined) {
    throw new Error("--match and --match-id require --season and --round for lineup mode.");
  }
  if (args.season !== undefined && args.round !== undefined) return "lineup";

  const teamName = args.name ?? args.team;
  if (args.season !== undefined) {
    if (teamName === undefined) {
      throw new Error(
        "--season requires --name or --team for squad mode, or --round for lineup mode.",
      );
    }
    return "squad";
  }
  return "list";
}

/** Reject round-scoped requests for season-only awards. */
export function validateAwardsMode(award: AwardType, round: number | undefined): void {
  if (round !== undefined && award !== "coaches") {
    throw new Error(
      `--round is not supported for --type ${award}. Round-scoped data is only available for coaches votes.`,
    );
  }
}
