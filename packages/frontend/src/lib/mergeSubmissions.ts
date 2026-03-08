import type { SubmissionData } from "./validation/submission";

type ContributionClient = SubmissionData["contributions"][number]["clients"][number];

function cloneClient(client: ContributionClient): ContributionClient {
  return {
    ...client,
    tokens: { ...client.tokens },
  };
}

function mergeClient(existing: ContributionClient, incoming: ContributionClient): ContributionClient {
  return {
    ...existing,
    providerId: existing.providerId || incoming.providerId,
    cost: existing.cost + incoming.cost,
    messages: existing.messages + incoming.messages,
    tokens: {
      input: existing.tokens.input + incoming.tokens.input,
      output: existing.tokens.output + incoming.tokens.output,
      cacheRead: existing.tokens.cacheRead + incoming.tokens.cacheRead,
      cacheWrite: existing.tokens.cacheWrite + incoming.tokens.cacheWrite,
      reasoning: existing.tokens.reasoning + incoming.tokens.reasoning,
    },
  };
}

function recalcDay(
  date: string,
  timestampMs: number | undefined,
  clients: ContributionClient[]
): SubmissionData["contributions"][number] {
  const totals = clients.reduce(
    (acc, client) => {
      acc.tokens +=
        client.tokens.input +
        client.tokens.output +
        client.tokens.cacheRead +
        client.tokens.cacheWrite +
        client.tokens.reasoning;
      acc.cost += client.cost;
      acc.messages += client.messages;
      acc.input += client.tokens.input;
      acc.output += client.tokens.output;
      acc.cacheRead += client.tokens.cacheRead;
      acc.cacheWrite += client.tokens.cacheWrite;
      acc.reasoning += client.tokens.reasoning;
      return acc;
    },
    {
      tokens: 0,
      cost: 0,
      messages: 0,
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      reasoning: 0,
    }
  );

  return {
    date,
    timestampMs,
    intensity: 0,
    totals: {
      tokens: totals.tokens,
      cost: totals.cost,
      messages: totals.messages,
    },
    tokenBreakdown: {
      input: totals.input,
      output: totals.output,
      cacheRead: totals.cacheRead,
      cacheWrite: totals.cacheWrite,
      reasoning: totals.reasoning,
    },
    clients,
  };
}

function applyIntensity(contributions: SubmissionData["contributions"]): SubmissionData["contributions"] {
  const maxCost = contributions.reduce((max, day) => Math.max(max, day.totals.cost), 0);
  if (maxCost === 0) return contributions;

  return contributions.map((day) => {
    const ratio = day.totals.cost / maxCost;
    const intensity = ratio >= 0.75 ? 4 : ratio >= 0.5 ? 3 : ratio >= 0.25 ? 2 : ratio > 0 ? 1 : 0;
    return { ...day, intensity };
  });
}

function recalcSummary(contributions: SubmissionData["contributions"]): SubmissionData["summary"] {
  const clients = new Set<string>();
  const models = new Set<string>();
  let totalTokens = 0;
  let totalCost = 0;
  let activeDays = 0;
  let maxCostInSingleDay = 0;

  for (const day of contributions) {
    totalTokens += day.totals.tokens;
    totalCost += day.totals.cost;
    if (day.totals.tokens > 0) activeDays += 1;
    maxCostInSingleDay = Math.max(maxCostInSingleDay, day.totals.cost);
    for (const client of day.clients) {
      clients.add(client.client);
      models.add(client.modelId);
    }
  }

  return {
    totalTokens,
    totalCost,
    totalDays: contributions.length,
    activeDays,
    averagePerDay: contributions.length > 0 ? totalCost / contributions.length : 0,
    maxCostInSingleDay,
    clients: Array.from(clients).sort() as SubmissionData["summary"]["clients"],
    models: Array.from(models).sort(),
  };
}

function recalcYears(contributions: SubmissionData["contributions"]): SubmissionData["years"] {
  const years = new Map<string, { totalTokens: number; totalCost: number; start: string; end: string }>();

  for (const day of contributions) {
    const year = day.date.slice(0, 4);
    const existing = years.get(year);
    if (existing) {
      existing.totalTokens += day.totals.tokens;
      existing.totalCost += day.totals.cost;
      if (day.date < existing.start) existing.start = day.date;
      if (day.date > existing.end) existing.end = day.date;
    } else {
      years.set(year, {
        totalTokens: day.totals.tokens,
        totalCost: day.totals.cost,
        start: day.date,
        end: day.date,
      });
    }
  }

  return Array.from(years.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([year, data]) => ({
      year,
      totalTokens: data.totalTokens,
      totalCost: data.totalCost,
      range: {
        start: data.start,
        end: data.end,
      },
    }));
}

export function mergeSubmissions(payloads: SubmissionData[]): SubmissionData {
  if (payloads.length === 0) {
    throw new Error("mergeSubmissions requires at least one payload");
  }

  const version = payloads[0].meta.version;
  const generatedAt = new Date().toISOString();
  const dayMap = new Map<string, { timestampMs: number | undefined; clients: Map<string, ContributionClient> }>();

  for (const payload of payloads) {
    for (const day of payload.contributions) {
      const existingDay = dayMap.get(day.date) ?? {
        timestampMs: day.timestampMs,
        clients: new Map<string, ContributionClient>(),
      };

      if (day.timestampMs != null) {
        existingDay.timestampMs = existingDay.timestampMs == null
          ? day.timestampMs
          : Math.min(existingDay.timestampMs, day.timestampMs);
      }

      for (const client of day.clients) {
        const key = `${client.client}::${client.modelId}::${client.providerId ?? ""}`;
        const existingClient = existingDay.clients.get(key);
        existingDay.clients.set(
          key,
          existingClient ? mergeClient(existingClient, client) : cloneClient(client)
        );
      }

      dayMap.set(day.date, existingDay);
    }
  }

  const contributions = applyIntensity(
    Array.from(dayMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, day]) => recalcDay(date, day.timestampMs, Array.from(day.clients.values())))
  );

  const summary = recalcSummary(contributions);
  const years = recalcYears(contributions);
  const dateRange = contributions.length > 0
    ? { start: contributions[0].date, end: contributions[contributions.length - 1].date }
    : payloads[0].meta.dateRange;

  return {
    meta: {
      generatedAt,
      version,
      dateRange,
    },
    summary,
    years,
    contributions,
  };
}
