import { afterEach, describe, expect, it, vi } from "vitest";
import { err, ok } from "../../src/lib/result";
import { AflCoachesClient } from "../../src/sources/afl-coaches";
import type { Match, PlayerStats } from "../../src/types";

const { fetchMatchesMock, fetchPlayerStatsMock } = vi.hoisted(() => ({
  fetchMatchesMock: vi.fn(),
  fetchPlayerStatsMock: vi.fn(),
}));

vi.mock("../../src/api/match", () => ({ fetchMatches: fetchMatchesMock }));
vi.mock("../../src/api/player-stats", () => ({ fetchPlayerStats: fetchPlayerStatsMock }));

import { fetchAwards } from "../../src/api/awards";

function brownlowHtml(): string {
  const rows = [
    ["Player", "Team", "V", "3V", "2V", "1V", "Played", "Polled", "V/G"],
    ["Blue Leader", "Carlton", "30", "10", "0", "0", "23", "10", "1.30"],
    ["Magpie Runner", "Collingwood", "20", "6", "1", "0", "23", "7", "0.87"],
    ["Filler One", "Richmond", "0", "0", "0", "0", "1", "0", "0.00"],
    ["Filler Two", "Geelong", "0", "0", "0", "0", "1", "0", "0.00"],
  ];
  return `<table>${rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("")}</table>`;
}

function allAustralianHtml(): string {
  return '<table><tr><td>FB</td><td><a>Blue Defender</a><span class="playerflag">Carlton</span></td></tr></table>';
}

function risingStarHtml(): string {
  const header = [
    "Rd",
    "Name",
    "Team",
    "Opponent",
    "K",
    "H",
    "D",
    "M",
    "G",
    "B",
    "T",
    "X",
    "X",
    "X",
    "X",
  ];
  const player = [
    "1",
    "Blue Youngster",
    "Carlton",
    "Richmond",
    "10",
    "8",
    "18",
    "4",
    "2",
    "1",
    "3",
    "",
    "",
    "",
    "",
  ];
  const filler = Array.from({ length: 3 }, (_, i) => [
    String(i + 2),
    `Player ${i}`,
    "Richmond",
    "Carlton",
    "1",
    "1",
    "2",
    "1",
    "0",
    "0",
    "1",
    "",
    "",
    "",
    "",
  ]);
  return `<table>${[header, player, ...filler].map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("")}</table>`;
}

function stubFootyWire(body: string, status = 200): ReturnType<typeof vi.fn> {
  const fetchStub = vi.fn(() => Promise.resolve(new Response(body, { status })));
  vi.stubGlobal("fetch", fetchStub);
  return fetchStub;
}

function match(matchId: string, roundType: Match["roundType"]): Match {
  return {
    matchId,
    season: 2025,
    roundNumber: roundType === "HomeAndAway" ? 1 : 25,
    roundType,
    roundName: roundType === "HomeAndAway" ? "Round 1" : "Qualifying Final",
    date: new Date("2025-03-14T08:40:00Z"),
    venue: "MCG",
    homeTeam: "Carlton",
    awayTeam: "Richmond",
    homeGoals: 10,
    homeBehinds: 5,
    homePoints: 65,
    awayGoals: 8,
    awayBehinds: 5,
    awayPoints: 53,
    margin: 12,
    q1Home: null,
    q2Home: null,
    q3Home: null,
    q4Home: null,
    q1Away: null,
    q2Away: null,
    q3Away: null,
    q4Away: null,
    status: "Complete",
    attendance: null,
    source: "afl-api",
  };
}

function playerStats(
  matchId: string,
  playerId: string,
  displayName: string,
  goals: number,
  team = "Carlton",
): PlayerStats {
  return {
    matchId,
    season: 2025,
    roundNumber: 1,
    team,
    competition: "AFLM",
    date: null,
    homeTeam: null,
    awayTeam: null,
    playerId,
    givenName: displayName.split(" ")[0] ?? "",
    surname: displayName.split(" ")[1] ?? "",
    displayName,
    jumperNumber: null,
    kicks: null,
    handballs: null,
    disposals: null,
    marks: null,
    goals,
    behinds: null,
    tackles: null,
    hitouts: null,
    freesFor: null,
    freesAgainst: null,
    contestedPossessions: null,
    uncontestedPossessions: null,
    contestedMarks: null,
    intercepts: null,
    centreClearances: null,
    stoppageClearances: null,
    totalClearances: null,
    inside50s: null,
    rebound50s: null,
    clangers: null,
    turnovers: null,
    onePercenters: null,
    bounces: null,
    goalAssists: null,
    disposalEfficiency: null,
    metresGained: null,
    goalAccuracy: null,
    marksInside50: null,
    tacklesInside50: null,
    shotsAtGoal: null,
    scoreInvolvements: null,
    totalPossessions: null,
    timeOnGroundPercentage: null,
    ratingPoints: null,
    position: null,
    goalEfficiency: null,
    shotEfficiency: null,
    interchangeCounts: null,
    brownlowVotes: null,
    supercoachScore: null,
    dreamTeamPoints: null,
    effectiveDisposals: null,
    effectiveKicks: null,
    kickEfficiency: null,
    kickToHandballRatio: null,
    pressureActs: null,
    defHalfPressureActs: null,
    spoils: null,
    hitoutsToAdvantage: null,
    hitoutWinPercentage: null,
    hitoutToAdvantageRate: null,
    groundBallGets: null,
    f50GroundBallGets: null,
    interceptMarks: null,
    marksOnLead: null,
    contestedPossessionRate: null,
    contestOffOneOnOnes: null,
    contestOffWins: null,
    contestOffWinsPercentage: null,
    contestDefOneOnOnes: null,
    contestDefLosses: null,
    contestDefLossPercentage: null,
    centreBounceAttendances: null,
    kickins: null,
    kickinsPlayon: null,
    ruckContests: null,
    scoreLaunches: null,
    source: "afl-api",
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  fetchMatchesMock.mockReset();
  fetchPlayerStatsMock.mockReset();
});

describe("fetchAwards FootyWire routing", () => {
  it.each([
    ["brownlow", "brownlow_medal", brownlowHtml(), "Blue Leader"],
    ["all-australian", "all_australian_selection", allAustralianHtml(), "Blue Defender"],
    ["rising-star", "rising_star_nominations", risingStarHtml(), "Blue Youngster"],
  ] as const)("routes and parses %s", async (award, path, html, player) => {
    const fetchStub = stubFootyWire(html);

    const result = await fetchAwards({ award, season: 2025 });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.some((entry) => "player" in entry && entry.player === player)).toBe(true);
    expect(fetchStub).toHaveBeenCalledOnce();
    expect(String(fetchStub.mock.calls[0]?.[0])).toContain(`${path}?year=2025`);
  });

  it.each(["AFLW", "VFL", "VFLW"] as const)(
    "rejects FootyWire awards for %s without fetching",
    async (competition) => {
      const fetchStub = stubFootyWire(brownlowHtml());

      const result = await fetchAwards({ award: "brownlow", season: 2025, competition });

      expect(result.success).toBe(false);
      expect(fetchStub).not.toHaveBeenCalled();
    },
  );

  it("propagates a non-OK upstream response", async () => {
    stubFootyWire("upstream unavailable", 503);

    const result = await fetchAwards({ award: "brownlow", season: 2025 });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.message).toContain("503");
  });

  it("returns an error when parsing yields no rows", async () => {
    stubFootyWire("<html><body>No award table</body></html>");

    const result = await fetchAwards({ award: "all-australian", season: 2025 });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.message).toContain("No All-Australian data");
  });

  it("applies team filtering before limit", async () => {
    stubFootyWire(brownlowHtml());

    const result = await fetchAwards({ award: "brownlow", season: 2025, team: "Blues", limit: 1 });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({ player: "Blue Leader", team: "Carlton" });
  });
});

describe("fetchAwards coaches filtering", () => {
  it("matches either home or away team and applies the limit", async () => {
    vi.spyOn(AflCoachesClient.prototype, "fetchSeasonVotes").mockResolvedValue(
      ok([
        {
          type: "coaches",
          season: 2025,
          competition: "AFLM",
          source: "afl-coaches",
          round: 1,
          homeTeam: "Carlton",
          awayTeam: "Richmond",
          player: "First Blue",
          votes: 10,
        },
        {
          type: "coaches",
          season: 2025,
          competition: "AFLM",
          source: "afl-coaches",
          round: 2,
          homeTeam: "Collingwood",
          awayTeam: "Carlton",
          player: "Second Blue",
          votes: 9,
        },
        {
          type: "coaches",
          season: 2025,
          competition: "AFLM",
          source: "afl-coaches",
          round: 3,
          homeTeam: "Richmond",
          awayTeam: "Geelong",
          player: "Tiger",
          votes: 8,
        },
      ]),
    );

    const result = await fetchAwards({ award: "coaches", season: 2025, team: "Blues", limit: 1 });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({ player: "First Blue" });
  });
});

describe("fetchAwards Coleman orchestration", () => {
  it("excludes finals stats by matching home-and-away match IDs", async () => {
    fetchMatchesMock.mockResolvedValue(ok([match("H1", "HomeAndAway"), match("F1", "Finals")]));
    fetchPlayerStatsMock.mockResolvedValue(
      ok({
        stats: [
          playerStats("H1", "home-leader", "Home Leader", 5),
          playerStats("F1", "finals-leader", "Finals Leader", 20),
        ],
        failedMatchIds: [],
      }),
    );

    const result = await fetchAwards({ award: "coleman", season: 2025 });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.map((entry) => "player" in entry && entry.player)).toEqual(["Home Leader"]);
    expect(fetchMatchesMock).toHaveBeenCalledWith({
      source: "afl-api",
      season: 2025,
      competition: "AFLM",
      status: "Complete",
    });
    expect(fetchPlayerStatsMock).toHaveBeenCalledWith({
      source: "afl-api",
      season: 2025,
      competition: "AFLM",
    });
  });

  it("filters the full Coleman field by team before applying the limit", async () => {
    fetchMatchesMock.mockResolvedValue(ok([match("H1", "HomeAndAway")]));
    fetchPlayerStatsMock.mockResolvedValue(
      ok({
        stats: [
          playerStats("H1", "leader", "League Leader", 8, "Richmond"),
          playerStats("H1", "blue-one", "First Blue", 6, "Carlton"),
          playerStats("H1", "blue-two", "Second Blue", 5, "Carlton"),
        ],
        failedMatchIds: [],
      }),
    );

    const result = await fetchAwards({
      award: "coleman",
      season: 2025,
      team: "Blues",
      limit: 1,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({ player: "First Blue", team: "Carlton" });
  });

  it.each([
    ["matches", new Error("matches unavailable")],
    ["stats", new Error("stats unavailable")],
  ] as const)("propagates %s upstream failure", async (failedSource, failure) => {
    fetchMatchesMock.mockResolvedValue(failedSource === "matches" ? err(failure) : ok([]));
    fetchPlayerStatsMock.mockResolvedValue(
      failedSource === "stats" ? err(failure) : ok({ stats: [], failedMatchIds: [] }),
    );

    const result = await fetchAwards({ award: "coleman", season: 2025 });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe(failure);
  });
});
