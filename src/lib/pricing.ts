import type { AIUsage } from "@/lib/ai/provider";

/** Rough $/million-token rates, USD. Deliberately approximate — good enough for spec §39's cost observability, not a billing system. */
const RATES_PER_MILLION: Record<string, { input: number; output: number }> = {
  "claude-sonnet-4-5": { input: 3, output: 15 },
  "claude-opus-4-5": { input: 15, output: 75 },
  "heuristic-v1": { input: 0, output: 0 },
};

export function estimateCostUsd(model: string, usage: AIUsage): number {
  const rate = RATES_PER_MILLION[model] ?? { input: 3, output: 15 };
  return (usage.promptTokens * rate.input + usage.completionTokens * rate.output) / 1_000_000;
}
