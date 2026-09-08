import type { ProcessModel } from "@/domain/processModel";

export interface CompletenessCheck {
  complete: boolean;
  missing: string[];
}

/**
 * Deterministic Level-1 ("essential", spec §10) completeness floor. The AI
 * may decide to finish the interview (spec §12), but the engine never
 * trusts that decision blindly — this hard-coded check is the safety net
 * that keeps "não bloquear desnecessariamente" (spec §32) from sliding into
 * "finish before the trigger/flow/end are even known".
 */
export function checkEssentialCompleteness(model: ProcessModel): CompletenessCheck {
  const missing: string[] = [];

  // Order matches spec §10's own priority: gatilho → fluxo principal →
  // responsáveis → decisões relevantes/caminhos → encerramento. `missing[0]`
  // drives which question gets asked next, so this order is not cosmetic —
  // checking encerramento before responsáveis previously caused answers
  // about one topic to be recorded under the other.
  if (!model.trigger || model.trigger.trim().length === 0) {
    missing.push("gatilho/início");
  }
  if (model.steps.length === 0) {
    missing.push("fluxo principal");
  }
  if (model.steps.length > 1 && !model.steps.some((s) => s.responsible)) {
    missing.push("responsáveis");
  }
  for (const decision of model.decisions) {
    if (decision.paths.length < 2) {
      missing.push(`caminhos da decisão "${decision.condition}"`);
    }
  }
  if (!model.endEvent || model.endEvent.trim().length === 0) {
    missing.push("encerramento/fim");
  }

  return { complete: missing.length === 0, missing };
}

/** A safe, generic follow-up question for a missing essential topic — used
 * both by the heuristic provider and as the engine's fallback when the AI
 * decides to finish but the deterministic floor above says otherwise. */
export function defaultQuestionForGap(missing: string): string {
  if (missing === "gatilho/início") {
    return "O que dá início a esse processo? Qual é o gatilho?";
  }
  if (missing === "fluxo principal") {
    return "Certo. Agora me conte o que acontece, passo a passo, do início ao fim.";
  }
  if (missing === "responsáveis") {
    return "Quem é responsável por cada uma dessas etapas?";
  }
  if (missing === "encerramento/fim") {
    return "Como esse processo é encerrado? O que marca o fim dele?";
  }
  if (missing.startsWith("caminhos da decisão")) {
    return "Na decisão que você mencionou, quais são os caminhos possíveis (por exemplo, sim/não) e o que acontece em cada um?";
  }
  return "Pode detalhar um pouco mais essa parte do processo?";
}
