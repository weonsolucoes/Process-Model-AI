import type { AIProvider } from "./provider";
import { HeuristicProvider } from "./heuristicProvider";
import { createAnthropicProvider } from "./anthropicProvider";

let cached: AIProvider | undefined;

/**
 * Provider selection (spec §38): explicit `AI_PROVIDER=anthropic` (or any
 * value other than "mock") with a key configured uses the real model;
 * otherwise the app falls back to the free, deterministic heuristic so
 * dev/CI never requires API credits.
 */
export function getAIProvider(): AIProvider {
  if (cached) return cached;

  const mode = process.env.AI_PROVIDER ?? "mock";
  if (mode !== "mock" && process.env.ANTHROPIC_API_KEY) {
    cached = createAnthropicProvider();
    return cached;
  }

  cached = new HeuristicProvider();
  return cached;
}

export type { AIProvider } from "./provider";
