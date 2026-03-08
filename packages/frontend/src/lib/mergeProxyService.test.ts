import { describe, expect, it, vi, beforeEach } from "vitest";
import { clearMergeProxyDevices, deleteMergeProxyDevice, getMergeProxyState, handleMergedSubmission, listMergeProxyDevices } from "./mergeProxyService";
import type { SubmissionData } from "./validation/submission";

const submissions = new Map<string, SubmissionData>();

vi.mock("@/lib/localMergeStore", () => ({
  saveDeviceSubmission: vi.fn(async (_token: string, deviceId: string, payload: SubmissionData) => {
    submissions.set(deviceId, payload);
  }),
  loadDeviceSubmissions: vi.fn(async () =>
    Array.from(submissions.entries()).map(([deviceId, payload]) => ({
      deviceId,
      updatedAt: "2026-03-09T00:00:00.000Z",
      payload,
    }))
  ),
  removeDeviceSubmission: vi.fn(async (_token: string, deviceId: string) => {
    submissions.delete(deviceId);
  }),
  resetDeviceSubmissions: vi.fn(async () => {
    submissions.clear();
  }),
}));

function makePayload(deviceDate: string, deviceClient: "codex" | "claude", modelId: string, tokens: number, cost: number): SubmissionData {
  return {
    meta: {
      generatedAt: "2026-03-08T00:00:00.000Z",
      version: "2.0.9",
      dateRange: { start: deviceDate, end: deviceDate },
    },
    summary: {
      totalTokens: tokens,
      totalCost: cost,
      totalDays: 1,
      activeDays: 1,
      averagePerDay: cost,
      maxCostInSingleDay: cost,
      clients: [deviceClient],
      models: [modelId],
    },
    years: [{ year: "2026", totalTokens: tokens, totalCost: cost, range: { start: deviceDate, end: deviceDate } }],
    contributions: [{
      date: deviceDate,
      timestampMs: 1700000000000,
      intensity: 1,
      totals: { tokens, cost, messages: 1 },
      tokenBreakdown: { input: tokens, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0 },
      clients: [{
        client: deviceClient,
        modelId,
        providerId: "test",
        tokens: { input: tokens, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0 },
        cost,
        messages: 1,
      }],
    }],
  };
}

describe("mergeProxyService", () => {
  beforeEach(() => {
    submissions.clear();
    global.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    })) as typeof fetch;
  });

  it("stores devices and forwards merged payload", async () => {
    await handleMergedSubmission("tt_token", "laptop", makePayload("2026-03-01", "codex", "gpt-5", 100, 1));
    const result = await handleMergedSubmission("tt_token", "desktop", makePayload("2026-03-01", "claude", "sonnet", 200, 2));

    expect(result.merged.summary.totalTokens).toBe(300);
    expect(result.devices).toHaveLength(2);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("lists, removes, and clears devices", async () => {
    await handleMergedSubmission("tt_token", "laptop", makePayload("2026-03-01", "codex", "gpt-5", 100, 1));
    await handleMergedSubmission("tt_token", "desktop", makePayload("2026-03-01", "claude", "sonnet", 200, 2));

    expect(await listMergeProxyDevices("tt_token")).toHaveLength(2);
    expect((await getMergeProxyState("tt_token")).merged?.summary.totalTokens).toBe(300);
    expect(await deleteMergeProxyDevice("tt_token", "laptop")).toHaveLength(1);
    expect(await clearMergeProxyDevices("tt_token")).toEqual([]);
  });
});
