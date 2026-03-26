import { parseArgs } from "citty";
import { describe, expect, it } from "vitest";

describe("CLI argument parsing", () => {
  const seasonArgs = {
    season: { type: "string" as const, required: true, description: "Season year" },
    round: { type: "string" as const, description: "Round number" },
    source: { type: "string" as const, default: "afl-api", description: "Data source" },
    competition: { type: "string" as const, default: "AFLM", description: "Competition" },
    json: { type: "boolean" as const, description: "Output as JSON" },
    csv: { type: "boolean" as const, description: "Output as CSV" },
    format: { type: "string" as const, description: "Output format" },
    full: { type: "boolean" as const, description: "Show all columns" },
  };

  describe("matches command args", () => {
    it("parses valid --season", () => {
      const parsed = parseArgs(["--season", "2025"], seasonArgs);
      expect(parsed.season).toBe("2025");
      expect(parsed.source).toBe("afl-api");
      expect(parsed.competition).toBe("AFLM");
    });

    it("parses --season with --round", () => {
      const parsed = parseArgs(["--season", "2025", "--round", "5"], seasonArgs);
      expect(parsed.season).toBe("2025");
      expect(parsed.round).toBe("5");
    });

    it("parses output format flags", () => {
      const parsed = parseArgs(["--season", "2025", "--json"], seasonArgs);
      expect(parsed.json).toBe(true);
    });

    it("parses --csv flag", () => {
      const parsed = parseArgs(["--season", "2025", "--csv"], seasonArgs);
      expect(parsed.csv).toBe(true);
    });

    it("parses --format flag", () => {
      const parsed = parseArgs(["--season", "2025", "--format", "csv"], seasonArgs);
      expect(parsed.format).toBe("csv");
    });

    it("parses --full flag", () => {
      const parsed = parseArgs(["--season", "2025", "--full"], seasonArgs);
      expect(parsed.full).toBe(true);
    });

    it("parses custom --source", () => {
      const parsed = parseArgs(["--season", "2025", "--source", "footywire"], seasonArgs);
      expect(parsed.source).toBe("footywire");
    });

    it("parses custom --competition", () => {
      const parsed = parseArgs(["--season", "2025", "--competition", "AFLW"], seasonArgs);
      expect(parsed.competition).toBe("AFLW");
    });
  });

  describe("stats command args", () => {
    const statsArgs = {
      ...seasonArgs,
      "match-id": { type: "string" as const, description: "Match ID" },
    };

    it("parses --match-id", () => {
      const parsed = parseArgs(["--season", "2025", "--match-id", "CD_M20250140101"], statsArgs);
      expect(parsed["match-id"]).toBe("CD_M20250140101");
    });
  });

  describe("lineup command args", () => {
    const lineupArgs = {
      ...seasonArgs,
      round: { type: "string" as const, required: true, description: "Round number" },
      "match-id": { type: "string" as const, description: "Match ID" },
    };

    it("parses required --season and --round", () => {
      const parsed = parseArgs(["--season", "2025", "--round", "1"], lineupArgs);
      expect(parsed.season).toBe("2025");
      expect(parsed.round).toBe("1");
    });
  });

  describe("squad command args", () => {
    const squadArgs = {
      "team-id": { type: "string" as const, required: true, description: "Team ID" },
      season: { type: "string" as const, required: true, description: "Season year" },
      competition: { type: "string" as const, default: "AFLM", description: "Competition" },
      json: { type: "boolean" as const, description: "Output as JSON" },
      csv: { type: "boolean" as const, description: "Output as CSV" },
      format: { type: "string" as const, description: "Output format" },
      full: { type: "boolean" as const, description: "Show all columns" },
    };

    it("parses --team-id and --season", () => {
      const parsed = parseArgs(["--team-id", "CD_T90", "--season", "2025"], squadArgs);
      expect(parsed["team-id"]).toBe("CD_T90");
      expect(parsed.season).toBe("2025");
    });
  });

  describe("teams command args", () => {
    const teamsArgs = {
      competition: { type: "string" as const, description: "Competition" },
      "team-type": { type: "string" as const, description: "Team type" },
      json: { type: "boolean" as const, description: "Output as JSON" },
      csv: { type: "boolean" as const, description: "Output as CSV" },
      format: { type: "string" as const, description: "Output format" },
      full: { type: "boolean" as const, description: "Show all columns" },
    };

    it("parses with no required args", () => {
      const parsed = parseArgs([], teamsArgs);
      expect(parsed.competition).toBeUndefined();
    });

    it("parses optional --competition", () => {
      const parsed = parseArgs(["--competition", "AFLW"], teamsArgs);
      expect(parsed.competition).toBe("AFLW");
    });

    it("parses optional --team-type", () => {
      const parsed = parseArgs(["--team-type", "senior"], teamsArgs);
      expect(parsed["team-type"]).toBe("senior");
    });
  });
});
