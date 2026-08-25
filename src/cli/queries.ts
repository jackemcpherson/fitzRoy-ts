/**
 * Helpers to build typed library query objects from validated CLI args.
 *
 * Each command's `args` come in as raw strings; the validators turn them
 * into typed values; these helpers package them into the exact `*Query`
 * shape the corresponding library function expects.
 *
 * Keeping the flag → query mapping in one place removes per-command
 * boilerplate and ensures the CLI surface stays consistent.
 */

import type {
  AwardQuery,
  AwardType,
  CompetitionCode,
  DataSource,
  LadderQuery,
  LineupQuery,
  MatchQuery,
  MatchStatus,
  PlayerStatsQuery,
  SquadQuery,
  TeamQuery,
  TeamStatsQuery,
} from "../types";

/** Common shape produced by validating the standard CLI flag set. */
export interface ValidatedCommonArgs {
  readonly source: DataSource;
  readonly season: number;
  readonly round?: number | undefined;
  readonly competition: CompetitionCode;
  readonly team?: string | undefined;
  readonly status?: MatchStatus | undefined;
  readonly matchId?: string | undefined;
  readonly playerId?: string | undefined;
}

export function buildMatchQuery(args: ValidatedCommonArgs): MatchQuery {
  return {
    source: args.source,
    season: args.season,
    round: args.round,
    matchId: args.matchId,
    team: args.team,
    status: args.status,
    competition: args.competition,
  };
}

export function buildPlayerStatsQuery(args: ValidatedCommonArgs): PlayerStatsQuery {
  return {
    source: args.source,
    season: args.season,
    round: args.round,
    matchId: args.matchId,
    competition: args.competition,
  };
}

export function buildTeamStatsQuery(
  args: Pick<ValidatedCommonArgs, "source" | "season" | "competition">,
): TeamStatsQuery {
  return {
    source: args.source,
    season: args.season,
    competition: args.competition,
  };
}

export function buildLadderQuery(
  args: Pick<ValidatedCommonArgs, "source" | "season" | "round" | "competition">,
): LadderQuery {
  return {
    source: args.source,
    season: args.season,
    round: args.round,
    competition: args.competition,
  };
}

export function buildSquadQuery(
  args: Pick<ValidatedCommonArgs, "season" | "competition"> & { team: string },
): SquadQuery {
  return {
    team: args.team,
    season: args.season,
    competition: args.competition,
  };
}

export function buildLineupQuery(
  args: Pick<ValidatedCommonArgs, "source" | "season" | "competition" | "matchId"> & {
    round: number;
  },
): LineupQuery {
  return {
    source: args.source,
    season: args.season,
    round: args.round,
    matchId: args.matchId,
    competition: args.competition,
  };
}

export function buildTeamQuery(args: Pick<ValidatedCommonArgs, "competition">): TeamQuery {
  return {
    competition: args.competition,
  };
}

export interface BuildAwardQueryArgs extends Pick<ValidatedCommonArgs, "season"> {
  readonly award: AwardType;
  readonly competition?: CompetitionCode | undefined;
  readonly round?: number | undefined;
  readonly team?: string | undefined;
  readonly limit?: number | undefined;
}

export function buildAwardQuery(args: BuildAwardQueryArgs): AwardQuery {
  return {
    award: args.award,
    season: args.season,
    competition: args.competition,
    round: args.round,
    team: args.team,
    limit: args.limit,
  };
}
