import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchMatchCoaches } from "../../src/api/match-coaches";
import { MatchCoachesClient } from "../../src/sources/match-coaches";

const fixture = (name: string) =>
  readFile(resolve(__dirname, `../fixtures/match-coaches/${name}`), "utf8");

afterEach(() => vi.unstubAllGlobals());

describe("fetchMatchCoaches", () => {
  it("reads coach profiles rather than club navigation from the captured index", async () => {
    const urls: string[] = [];
    const index = await fixture("afl-tables-index-captured.html");
    const profile = await fixture("afl-tables-hansen.html");
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      const url = String(input);
      urls.push(url);
      return new Response(url.endsWith("coaches_idx.html") ? index : profile);
    });
    const result = await fetchMatchCoaches({ season: 2022, batch: { limit: 1 } });
    expect(result.success).toBe(true);
    expect(urls).toEqual([
      "https://afltables.com/afl/stats/coaches/coaches_idx.html",
      "https://afltables.com/afl/stats/coaches/Mick_Malthouse.html",
    ]);
    if (!result.success) return;
    expect(result.data.batch?.nextCursor).not.toContain("/adelaide.html");
    expect(result.data.batch?.nextCursor).toContain("Jock_McHale.html");
  });

  it("returns sourced assignments and a complete envelope from AFL Tables", async () => {
    const index = await fixture("afl-tables-index.html");
    const profile = await fixture("afl-tables-hansen.html");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        return new Response(url.endsWith("coaches_idx.html") ? index : profile);
      }),
    );

    const result = await fetchMatchCoaches({ season: 2022 });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.completeness).toEqual({ complete: true, failures: [] });
    expect(result.data.assignments).toEqual([
      expect.objectContaining({
        season: 2022,
        team: "Carlton",
        coachId: "afl-tables:https://afltables.com/afl/stats/coaches/Ashley_Hansen.html",
        coachName: "Ashley Hansen",
        matchId: "afl-tables:https://afltables.com/afl/stats/games/2022/030720220324.html",
        date: "2022-03-24",
        homeTeam: "Carlton",
        awayTeam: "Western Bulldogs",
        homePoints: 102,
        awayPoints: 90,
        source: "afl-tables",
      }),
    ]);
  });

  it("returns an expected error when every upstream profile fails", async () => {
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) =>
      String(input).endsWith("coaches_idx.html")
        ? new Response(await fixture("afl-tables-index.html"))
        : new Response("unavailable", { status: 503 }),
    );
    const result = await fetchMatchCoaches({ season: 2022 });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.name).toBe("ScrapeError");
  });

  it("returns an empty complete result for a valid season with no assignments", async () => {
    const index = await fixture("afl-tables-index.html");
    const profile = (await fixture("afl-tables-hansen.html")).replaceAll("2022", "2021");
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async (input: RequestInfo | URL) =>
          new Response(String(input).endsWith("coaches_idx.html") ? index : profile),
      ),
    );
    const result = await fetchMatchCoaches({ season: 2022 });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.assignments).toEqual([]);
    expect(result.data.completeness).toEqual({ complete: true, failures: [] });
  });

  it("returns structured errors for unsupported sources and competitions", async () => {
    const unsupportedSource = await fetchMatchCoaches({ season: 2022, source: "afl-api" });
    expect(unsupportedSource.success).toBe(false);
    if (!unsupportedSource.success)
      expect(unsupportedSource.error.name).toBe("UnsupportedSourceError");

    const sourceResult = await fetchMatchCoaches({
      season: 2022,
      source: "footywire",
      competition: "AFLW",
    });
    expect(sourceResult.success).toBe(false);
    if (sourceResult.success) return;
    expect(sourceResult.error.name).toBe("UnsupportedCompetitionError");
  });

  it("keeps historical Bears and Fitzroy identities distinct from Brisbane Lions", async () => {
    const { normaliseTeamName } = await import("../../src/lib/team-mapping");
    expect(normaliseTeamName("Bears")).toBe("Brisbane Bears");
    expect(normaliseTeamName("Fitzroy")).toBe("Fitzroy");
    expect(normaliseTeamName("Brisbane")).toBe("Brisbane Lions");
  });

  it("extracts explicit FootyWire match-page coach assignments", async () => {
    const page = await fixture("footywire-match.html");
    const client = new MatchCoachesClient({
      fetchFn: async () => new Response(page),
    });
    const result = await client.fetchFootyWireMatches([
      {
        competition: "AFLM",
        season: 2024,
        matchId: "FW_11174",
        date: new Date("2024-03-16T00:00:00Z"),
        homeTeam: "Adelaide Crows",
        awayTeam: "Richmond",
        homePoints: 90,
        awayPoints: 70,
        roundName: "Round 1",
      },
    ]);
    expect(result.failures).toEqual([]);
    expect(result.assignments).toEqual([
      expect.objectContaining({
        team: "Adelaide Crows",
        coachId: "footywire:https://www.footywire.com/afl/footy/cp-example",
        coachName: "Example Home Coach",
        matchId: "footywire:FW_11174",
        source: "footywire",
      }),
      expect.objectContaining({ team: "Richmond", coachName: "Example Away Coach" }),
    ]);
  });
  it("reports a missing participant rather than complete FootyWire coverage", async () => {
    const client = new MatchCoachesClient({
      fetchFn: async () =>
        new Response(
          '<table><tr><td>Carlton Coach</td><td><a href="/afl/footy/cp-one">Coach A</a></td></tr></table>',
        ),
    });
    const result = await client.fetchFootyWireMatches([
      {
        competition: "AFLM",
        season: 2024,
        matchId: "FW_1",
        date: new Date("2024-03-16"),
        homeTeam: "Carlton",
        awayTeam: "Richmond",
        homePoints: 81,
        awayPoints: 74,
        roundName: "Round 1",
      },
    ]);
    expect(result.assignments).toHaveLength(1);
    expect(result.failures).toHaveLength(1);
  });

  it("rejects malformed source scores rather than trusting an assignment", async () => {
    const original = await fixture("afl-tables-hansen.html");
    const profile = original.replace(/<td[^>]*>102<\/td>/, "<td>unknown</td>");
    expect(profile).not.toBe(original);
    vi.stubGlobal(
      "fetch",
      async (input: RequestInfo | URL) =>
        new Response(
          String(input).endsWith("coaches_idx.html")
            ? await fixture("afl-tables-index.html")
            : profile,
        ),
    );
    expect((await fetchMatchCoaches({ season: 2022 })).success).toBe(false);
  });

  it("limits profile batches and resumes the remaining profiles", async () => {
    const urls: string[] = [];
    const profile = await fixture("afl-tables-hansen.html");
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      urls.push(String(input));
      return new Response(
        String(input).endsWith("coaches_idx.html")
          ? '<a href="Ashley_Hansen.html">Ashley Hansen</a><a href="Other_Coach.html">Other Coach</a>'
          : String(input).endsWith("Other_Coach.html")
            ? profile.replaceAll("Ashley Hansen", "Other Coach")
            : profile,
      );
    });
    const first = await fetchMatchCoaches({ season: 2022, batch: { limit: 1 } });
    expect(first.success).toBe(true);
    if (!first.success) return;
    expect(first.data.batch?.scope).toBe("pages");
    expect(first.data.batch?.nextCursor).toBeTruthy();
    expect(urls).toHaveLength(2);
    const nextCursor = first.data.batch?.nextCursor;
    if (!nextCursor) throw new Error("Expected a continuation cursor");
    const next = await fetchMatchCoaches({ season: 2022, batch: { limit: 1, cursor: nextCursor } });
    expect(next.success).toBe(true);
    if (!next.success) return;
    expect(next.data.batch?.nextCursor).toBeNull();
    expect(urls).toHaveLength(3);
    expect(next.data.assignments[0]?.coachName).toBe("Other Coach");
  });
  it.each([
    [
      "bolton",
      "Brendon_Bolton",
      "Brendon Bolton",
      2014,
      "Hawthorn",
      ["102120140601", "101820140607", "031020140613", "041020140621", "102020140628"],
    ],
    ["connolly", "Chris_Connolly", "Chris Connolly", 2001, "Hawthorn", ["031020010729"]],
    [
      "teague",
      "David_Teague",
      "David Teague",
      2019,
      "Carlton",
      [
        "031920190608",
        "030720190615",
        "030820190630",
        "031120190707",
        "031620190713",
        "032020190720",
        "010320190727",
        "031820190804",
        "031420190811",
        "031520190817",
        "030920190824",
      ],
    ],
  ] as const)(
    "preserves exact source credits for %s",
    async (slug, key, name, season, team, ids) => {
      const page = await fixture(`afl-tables-${slug}.html`);
      vi.stubGlobal(
        "fetch",
        async (input: RequestInfo | URL) =>
          new Response(
            String(input).endsWith("coaches_idx.html") ? `<a href="${key}.html">${name}</a>` : page,
          ),
      );
      const result = await fetchMatchCoaches({ season });
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.completeness).toEqual({ complete: true, failures: [] });
      expect(result.data.assignments.map((row) => [row.team, row.coachName, row.matchId])).toEqual(
        ids.map((id) => [
          team,
          name,
          `afl-tables:https://afltables.com/afl/stats/games/${season}/${id}.html`,
        ]),
      );
    },
  );
});
