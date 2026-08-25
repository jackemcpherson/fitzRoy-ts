import { describe, expect, it, vi } from "vitest";
import { ok } from "../../../src/lib/result";
import { AflTablesSquadSource } from "../../../src/sources/adapters/afl-tables";
import { FootyWireSquadSource } from "../../../src/sources/adapters/footywire";
import type { AflTablesClient } from "../../../src/sources/afl-tables";
import type { FootyWireClient } from "../../../src/sources/footywire";

describe("scraped squad scope", () => {
  it.each([
    [
      "footywire",
      () =>
        new FootyWireSquadSource({
          fetchPlayerList: vi.fn().mockResolvedValue(ok([])),
        } as unknown as FootyWireClient),
    ],
    [
      "afl-tables",
      () =>
        new AflTablesSquadSource({
          fetchPlayerList: vi.fn().mockResolvedValue(ok([])),
        } as unknown as AflTablesClient),
    ],
  ] as const)("stamps %s squads as all-time", async (_source, createSource) => {
    const result = await createSource().fetchSquad({
      source: _source,
      team: "Carlton",
      season: 2024,
      competition: "AFLM",
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.scope).toBe("all-time");
    expect(result.data.season).toBe(2024);
  });
});
