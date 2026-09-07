import { nextId, type ProcessModel } from "@/domain/processModel";
import type { ExtractionUpdate } from "@/domain/interviewTypes";

/**
 * Deterministic, code-only merge of an AI-proposed update into the Process
 * Model. This is the load-bearing anti-hallucination boundary: the model
 * never writes ProcessModel fields directly, it only proposes an
 * ExtractionUpdate, and this function is the sole place new steps,
 * decisions, etc. get an id and get appended — nothing here is invented
 * beyond exactly what `update` contains (spec §19, §44).
 */
export function mergeExtractionUpdate(model: ProcessModel, update: ExtractionUpdate): ProcessModel {
  const next: ProcessModel = structuredClone(model);

  if (update.topLevel.objective && !next.objective) next.objective = update.topLevel.objective;
  if (update.topLevel.owner && !next.owner) next.owner = update.topLevel.owner;
  if (update.topLevel.trigger && !next.trigger) next.trigger = update.topLevel.trigger;
  if (update.topLevel.endEvent && !next.endEvent) next.endEvent = update.topLevel.endEvent;

  for (const s of update.addSteps) {
    next.steps.push({
      id: nextId("step"),
      activity: s.activity,
      responsible: s.responsible ?? null,
      input: s.input ?? null,
      output: s.output ?? null,
      systemTool: s.systemTool ?? null,
      order: next.steps.length,
      nextStepId: null,
      decisionId: null,
    });
  }
  relinkSteps(next);

  for (const patch of update.patchSteps) {
    const stepId = findStepIdByActivity(next, patch.stepActivityHint);
    const step = stepId ? next.steps.find((s) => s.id === stepId) : undefined;
    if (!step) continue;
    // Only fills currently-null attributes — never overwrites a value the
    // user already gave, which would need to go through the contradiction
    // flow instead (spec §17).
    if (patch.responsible && !step.responsible) step.responsible = patch.responsible;
    if (patch.input && !step.input) step.input = patch.input;
    if (patch.output && !step.output) step.output = patch.output;
    if (patch.systemTool && !step.systemTool) step.systemTool = patch.systemTool;
  }

  for (const d of update.addDecisions) {
    const id = nextId("decision");
    const afterStep = next.steps[next.steps.length - 1];
    const paths = d.paths.map((p) => ({
      label: p.label,
      description: p.description ?? null,
      nextStepId: p.nextStepActivityHint ? findStepIdByActivity(next, p.nextStepActivityHint) : null,
    }));
    next.decisions.push({
      id,
      afterStepId: afterStep?.id ?? null,
      condition: d.condition,
      responsible: d.responsible ?? null,
      paths,
    });
    if (afterStep) {
      afterStep.decisionId = id;
      afterStep.nextStepId = null;
    }
  }

  for (const e of update.addExceptions) {
    next.exceptions.push({
      id: nextId("exception"),
      description: e.description,
      condition: e.condition ?? null,
      treatment: e.treatment ?? null,
      responsible: e.responsible ?? null,
      relatedStepId: e.relatedStepActivityHint
        ? findStepIdByActivity(next, e.relatedStepActivityHint)
        : null,
      returnsToStepId: e.returnsToStepActivityHint
        ? findStepIdByActivity(next, e.returnsToStepActivityHint)
        : null,
    });
  }

  for (const r of update.addBusinessRules) {
    next.businessRules.push({
      id: nextId("rule"),
      rule: r.rule,
      condition: r.condition ?? null,
      responsible: r.responsible ?? null,
      consequence: r.consequence ?? null,
    });
  }

  for (const p of update.addProblems) {
    next.problems.push({
      id: nextId("problem"),
      description: p.description,
      processStepId: p.relatedStepActivityHint
        ? findStepIdByActivity(next, p.relatedStepActivityHint)
        : null,
      type: p.type,
      evidence: p.evidence,
      impact: p.impact ?? null,
      frequency: p.frequency ?? null,
      confidence: p.confidence,
    });
  }

  for (const q of update.addQuickWins) {
    next.quickWins.push({
      id: nextId("quickwin"),
      opportunity: q.opportunity,
      relatedProblemId: q.relatedProblemDescriptionHint
        ? findProblemIdByDescription(next, q.relatedProblemDescriptionHint)
        : null,
      suggestion: q.suggestion,
      effort: q.effort ?? null,
      potentialImpact: q.potentialImpact ?? null,
      dependencies: q.dependencies ?? null,
      confidence: q.confidence ?? "hypothesis",
    });
  }

  for (const v of update.addValidationPoints) {
    next.validationPoints.push({
      id: nextId("vp"),
      field: v.field,
      description: v.description,
      resolved: false,
    });
  }

  for (const o of update.addObservations) {
    next.observations.push(o);
  }

  return next;
}

function relinkSteps(model: ProcessModel): void {
  for (let i = 0; i < model.steps.length; i += 1) {
    const step = model.steps[i];
    if (!step || step.decisionId) continue;
    const following = model.steps[i + 1];
    step.nextStepId = following ? following.id : null;
  }
}

function findStepIdByActivity(model: ProcessModel, hint: string): string | null {
  const norm = hint.trim().toLowerCase();
  if (!norm) return null;
  const exact = model.steps.find((s) => s.activity.trim().toLowerCase() === norm);
  if (exact) return exact.id;
  const partial = model.steps.find(
    (s) => s.activity.toLowerCase().includes(norm) || norm.includes(s.activity.toLowerCase()),
  );
  return partial ? partial.id : null;
}

function findProblemIdByDescription(model: ProcessModel, hint: string): string | null {
  const norm = hint.trim().toLowerCase();
  if (!norm) return null;
  const match = model.problems.find(
    (p) => p.description.toLowerCase().includes(norm) || norm.includes(p.description.toLowerCase()),
  );
  return match ? match.id : null;
}
