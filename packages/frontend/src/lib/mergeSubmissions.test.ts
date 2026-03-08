import { describe, expect, it } from "vitest";
import { mergeSubmissions } from "./mergeSubmissions";
import type { SubmissionData } from "./validation/submission";

function makePayload(deviceDate: string, modelId: string, tokens: number, cost: number): SubmissionData {
  return {
    meta: {
      generatedAt: "2026-03-08T00:00:00.000Z",
      version: "2.0.9",
      dateRange: {
        start: deviceDate,
        end: deviceDate,
      },
    },
    summary: {
      totalTokens: tokens,
      totalCost: cost,
      totalDays: 1,
      activeDays: 1,
      averagePerDay: cost,
      maxCostInSingleDay: cost,
      clients: ["codex"],
      models: [modelId],
    },
    years: [
      {
        year: deviceDate.slice(0, 4),
        totalTokens: tokens,
        totalCost: cost,
        range: { start: deviceDate, end: deviceDate },
      },
    ],
    contributions: [
      {
        date: deviceDate,
        timestampMs: 1700000000000,
        intensity: 1,
        totals: { tokens, cost, messages: 2 },
        tokenBreakdown: {
          input: Math.floor(tokens / 2),
          output: tokens - Math.floor(tokens / 2),
          cacheRead: 0,
          cacheWrite: 0,
          reasoning: 0,
        },
        clients: [
          {
            client: "codex",
            modelId,
            providerId: "openai",
            tokens: {
              input: Math.floor(tokens / 2),
              output: tokens - Math.floor(tokens / 2),
              cacheRead: 0,
              cacheWrite: 0,
              reasoning: 0,
            },
            cost,
            messages: 2,
          },
        ],
      },
    ],
  };
}

describe("mergeSubmissions", () => {
  it("merges multiple devices for the same day", () => {
    const merged = mergeSubmissions([
      makePayload("2026-03-01", "gpt-5", 100, 1.25),
      makePayload("2026-03-01", "claude-sonnet-4-5", 300, 4.5),
    ]);

    expect(merged.summary.totalTokens).toBe(400);
    expect(merged.summary.totalCost).toBeCloseTo(5.75);
    expect(merged.contributions).toHaveLength(1);
    expect(merged.contributions[0].clients).toHaveLength(2);
    expect(merged.summary.models).toEqual(["claude-sonnet-4-5", "gpt-5"]);
  });

  it("merges identical client-model-provider rows", () => {
    const merged = mergeSubmissions([
      makePayload("2026-03-01", "gpt-5", 100, 1.25),
      makePayload("2026-03-01", "gpt-5", 50, 0.75),
    ]);

    expect(merged.summary.totalTokens).toBe(150);
    expect(merged.summary.totalCost).toBeCloseTo(2.0);
    expect(merged.contributions[0].clients).toHaveLength(1);
    expect(merged.contributions[0].clients[0].messages).toBe(4);
  });
});
