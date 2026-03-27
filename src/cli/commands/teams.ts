import { defineCommand } from "citty";
import { fetchTeams } from "../../index";
import { withErrorBoundary } from "../error-boundary";
import { OPTIONAL_COMPETITION_FLAG, OUTPUT_FLAGS } from "../flags";
import { type FormatOptions, formatOutput, type TableColumnConfig } from "../formatters/index";
import { showSummary, withSpinner } from "../ui";
import { validateFormat, validateOptionalCompetition } from "../validation";

const DEFAULT_COLUMNS: TableColumnConfig[] = [
  { key: "teamId", label: "ID", maxWidth: 8 },
  { key: "name", label: "Team", maxWidth: 24 },
  { key: "abbreviation", label: "Abbr", maxWidth: 6 },
  { key: "competition", label: "Comp", maxWidth: 6 },
];

export const teamsCommand = defineCommand({
  meta: {
    name: "teams",
    description: "Fetch team list",
  },
  args: {
    ...OPTIONAL_COMPETITION_FLAG,
    "team-type": { type: "string", description: "Team type filter" },
    ...OUTPUT_FLAGS,
  },
  run: withErrorBoundary(async ({ args }) => {
    const competition = validateOptionalCompetition(args.competition);
    const format = validateFormat(args.format);

    const result = await withSpinner("Fetching teams…", () =>
      fetchTeams({ competition, teamType: args["team-type"] }),
    );

    if (!result.success) {
      throw result.error;
    }

    const data = result.data;

    if (data.length === 0 && args["team-type"]) {
      console.error(
        `No teams found for team type "${args["team-type"]}". Try running without --team-type to see available teams.`,
      );
    }

    showSummary(`Loaded ${data.length} teams`);

    const formatOptions: FormatOptions = {
      json: args.json,
      csv: args.csv,
      format,
      full: args.full,
      columns: DEFAULT_COLUMNS,
    };

    console.log(formatOutput(data, formatOptions));
  }),
});
