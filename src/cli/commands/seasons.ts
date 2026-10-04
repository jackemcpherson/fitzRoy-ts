import { fetchSeasons } from "../../api/season";
import { defineFitzroyCommand } from "../command-builder";
import { COMPETITION_FLAG, OUTPUT_FLAGS } from "../flags";
import { validateCompetition } from "../validation";

/** Discover explicit season selectors for a competition. */
export const seasonsCommand = defineFitzroyCommand({
  meta: { name: "seasons", description: "Discover competition seasons and provider IDs" },
  args: { ...COMPETITION_FLAG, ...OUTPUT_FLAGS },
  columns: [
    { key: "seasonKey", label: "Season" },
    { key: "year", label: "Year" },
    { key: "displayName", label: "Name" },
    { key: "providerSeasonId", label: "Provider ID" },
  ],
  run: (args) => fetchSeasons(validateCompetition(String(args.competition))),
});
