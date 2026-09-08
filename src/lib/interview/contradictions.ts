import type { Contradiction, ProcessModel } from "@/domain/processModel";
import type { ExtractionUpdate, NewValidationPointInput } from "@/domain/interviewTypes";

const TOP_LEVEL_FIELDS = ["objective", "owner", "trigger", "endEvent"] as const;
type TopLevelField = (typeof TOP_LEVEL_FIELDS)[number];

function isTopLevelField(field: string): field is TopLevelField {
  return (TOP_LEVEL_FIELDS as readonly string[]).includes(field);
}

/**
 * Spec §17: a contradiction must never be resolved by silently picking a
 * version. Any top-level field the AI flagged as conflicting is stripped
 * out of the update before it reaches the merge step — it only gets
 * written once the user has confirmed which value stands.
 */
export function stripContradictedFields(
  update: ExtractionUpdate,
  contradictions: Contradiction[],
): ExtractionUpdate {
  if (contradictions.length === 0) return update;

  const contradictedFields = new Set(contradictions.map((c) => c.field));
  const topLevel = { ...update.topLevel };
  for (const field of TOP_LEVEL_FIELDS) {
    if (contradictedFields.has(field)) {
      delete topLevel[field];
    }
  }
  return { ...update, topLevel };
}

/**
 * Only `objective/owner/trigger/endEvent` can actually be confirmed and
 * written back by `resolveNextContradiction` below. Asking the user to
 * confirm a contradiction the system has no way to apply would be a
 * dead end — the confirmation prompt would be shown, but the answer
 * would silently have no effect. Splitting here lets the engine turn an
 * unsupported contradiction into a visible `validationPoint` instead of a
 * blocking question that goes nowhere.
 */
export function partitionContradictions(contradictions: Contradiction[]): {
  supported: Contradiction[];
  unsupported: Contradiction[];
} {
  const supported: Contradiction[] = [];
  const unsupported: Contradiction[] = [];
  for (const c of contradictions) {
    (isTopLevelField(c.field) ? supported : unsupported).push(c);
  }
  return { supported, unsupported };
}

export function contradictionToValidationPoint(c: Contradiction): NewValidationPointInput {
  return {
    field: c.field,
    description: `Possível contradição não confirmada automaticamente: antes foi dito "${c.existingValue}", depois "${c.newValue}". ${c.explanation}`,
  };
}

export function formatContradictionPrompt(contradictions: Contradiction[]): string {
  const lines = contradictions.map(
    (c) =>
      `- Sobre "${c.field}": você havia dito "${c.existingValue}", agora mencionou "${c.newValue}". ${c.explanation}`,
  );
  return `Antes de continuar, preciso confirmar uma informação que parece ter mudado:\n${lines.join("\n")}\n\nQual das duas está correta?`;
}

/**
 * Interprets the user's free-text answer to a pending contradiction and
 * resolves the first one in the queue. If the answer doesn't clearly match
 * either side, the user's own words become the field's value — we never
 * guess on their behalf, we just trust what they typed as the correction.
 */
export function resolveNextContradiction(model: ProcessModel, answer: string): ProcessModel {
  const [current, ...rest] = model.pendingContradictions;
  if (!current) return model;

  const norm = answer.trim().toLowerCase();
  let resolvedValue: string;
  if (/segund|nov[ao]|últim|ultim/.test(norm) && !/primeir|antig/.test(norm)) {
    resolvedValue = current.newValue;
  } else if (/primeir|antig/.test(norm) && !/segund|nov[ao]/.test(norm)) {
    resolvedValue = current.existingValue;
  } else if (norm.includes(current.newValue.toLowerCase())) {
    resolvedValue = current.newValue;
  } else if (norm.includes(current.existingValue.toLowerCase())) {
    resolvedValue = current.existingValue;
  } else {
    resolvedValue = answer.trim();
  }

  const next = structuredClone(model);
  next.pendingContradictions = rest;
  if (isTopLevelField(current.field)) {
    next[current.field] = resolvedValue;
  }
  return next;
}

export { isTopLevelField };
