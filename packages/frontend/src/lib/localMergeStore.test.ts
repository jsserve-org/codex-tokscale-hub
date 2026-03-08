import { beforeEach, describe, expect, it, vi } from "vitest";

const files = new Map<string, string>();

vi.mock("node:crypto", () => ({
  createHash: () => ({
    update: () => ({
      digest: () => "sha",
    }),
  }),
}));

vi.mock("node:os", () => ({ homedir: () => "/tmp/home" }));
vi.mock("node:fs/promises", () => ({
  mkdir: vi.fn(async () => undefined),
  readdir: vi.fn(async () => [
    { isFile: () => true, name: "fresh.json" },
    { isFile: () => true, name: "stale.json" },
  ]),
  readFile: vi.fn(async (path: string) => files.get(path) ?? ""),
  writeFile: vi.fn(async () => undefined),
  unlink: vi.fn(async (path: string) => {
    files.delete(path);
  }),
  rm: vi.fn(async () => undefined),
}));

describe("localMergeStore TTL pruning", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-09T12:00:00.000Z"));
    process.env.TOKSCALE_MERGE_TTL_HOURS = "24";
    files.clear();

    files.set(
      "/tmp/home/.config/tokscale/merge-cache/sha/fresh.json",
      JSON.stringify({
        deviceId: "fresh",
        updatedAt: "2026-03-09T10:00:00.000Z",
        payload: { summary: {}, meta: {}, years: [], contributions: [] },
      }),
    );
    files.set(
      "/tmp/home/.config/tokscale/merge-cache/sha/stale.json",
      JSON.stringify({
        deviceId: "stale",
        updatedAt: "2026-03-01T10:00:00.000Z",
        payload: { summary: {}, meta: {}, years: [], contributions: [] },
      }),
    );
  });

  it("drops stale entries while returning fresh ones", async () => {
    const { loadDeviceSubmissions } = await import("./localMergeStore");

    const records = await loadDeviceSubmissions("tt_token");
    expect(records).toHaveLength(1);
    expect(records[0].deviceId).toBe("fresh");
  });
});
