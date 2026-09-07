/**
 * The Process Model is the single source of truth for everything the
 * Interview Engine has learned about a business process (spec §19).
 * Every deliverable (AS IS, flowchart, diagnosis, quick wins) is derived
 * from this structure and nothing else — no generator may invent fields
 * that are not present here (spec §19, §25).
 */
import { z } from "zod";

export const ProblemTypeSchema = z.enum([
  "rework",
  "waiting",
  "bottleneck",
  "people_dependency",
  "duplication",
  "communication",
  "risk",
  "unnecessary_step",
  "lack_of_standardization",
  "possible_automation",
  "other",
]);
export type ProblemType = z.infer<typeof ProblemTypeSchema>;

/** Fact = evidenced in the interview. Hypothesis = plausible but unconfirmed (spec §22). */
export const ConfidenceSchema = z.enum(["fact", "hypothesis"]);
export type Confidence = z.infer<typeof ConfidenceSchema>;

export const IdentificationSchema = z.object({
  processName: z.string().min(1),
  area: z.string().nullable().default(null),
  respondentRole: z.string().nullable().default(null),
  initialDescription: z.string().nullable().default(null),
});
export type Identification = z.infer<typeof IdentificationSchema>;

export const StepSchema = z.object({
  id: z.string(),
  activity: z.string().min(1),
  responsible: z.string().nullable().default(null),
  input: z.string().nullable().default(null),
  output: z.string().nullable().default(null),
  systemTool: z.string().nullable().default(null),
  /** Ordering within the main flow; also used to derive nextStepId when absent. */
  order: z.number().int().nonnegative(),
  nextStepId: z.string().nullable().default(null),
  /** Set when this step ends in a decision instead of flowing linearly. */
  decisionId: z.string().nullable().default(null),
});
export type Step = z.infer<typeof StepSchema>;

export const DecisionPathSchema = z.object({
  label: z.string().min(1),
  description: z.string().nullable().default(null),
  nextStepId: z.string().nullable().default(null),
});
export type DecisionPath = z.infer<typeof DecisionPathSchema>;

export const DecisionSchema = z.object({
  id: z.string(),
  /** The step after which this decision is evaluated. */
  afterStepId: z.string().nullable().default(null),
  condition: z.string().min(1),
  responsible: z.string().nullable().default(null),
  paths: z.array(DecisionPathSchema).default([]),
});
export type Decision = z.infer<typeof DecisionSchema>;

export const ExceptionSchema = z.object({
  id: z.string(),
  description: z.string().min(1),
  condition: z.string().nullable().default(null),
  treatment: z.string().nullable().default(null),
  responsible: z.string().nullable().default(null),
  /** The main-flow step during which this exception can occur — anchors it on the flowchart. */
  relatedStepId: z.string().nullable().default(null),
  returnsToStepId: z.string().nullable().default(null),
});
export type Exception = z.infer<typeof ExceptionSchema>;

export const BusinessRuleSchema = z.object({
  id: z.string(),
  rule: z.string().min(1),
  condition: z.string().nullable().default(null),
  responsible: z.string().nullable().default(null),
  consequence: z.string().nullable().default(null),
});
export type BusinessRule = z.infer<typeof BusinessRuleSchema>;

export const ProblemSchema = z.object({
  id: z.string(),
  description: z.string().min(1),
  processStepId: z.string().nullable().default(null),
  type: ProblemTypeSchema,
  /** The concrete statement from the interview that supports this finding. Required — spec §22/§23. */
  evidence: z.string().min(1),
  impact: z.string().nullable().default(null),
  frequency: z.string().nullable().default(null),
  confidence: ConfidenceSchema,
});
export type Problem = z.infer<typeof ProblemSchema>;

export const QuickWinSchema = z.object({
  id: z.string(),
  opportunity: z.string().min(1),
  relatedProblemId: z.string().nullable().default(null),
  suggestion: z.string().min(1),
  effort: z.enum(["low", "medium", "high"]).nullable().default(null),
  potentialImpact: z.string().nullable().default(null),
  dependencies: z.string().nullable().default(null),
  confidence: ConfidenceSchema.default("hypothesis"),
});
export type QuickWin = z.infer<typeof QuickWinSchema>;

/**
 * A conflict between a newly stated fact and something already recorded.
 * Never resolved automatically (spec §17) — it sits on the Process Model
 * until the user confirms which value is correct.
 */
export const ContradictionSchema = z.object({
  field: z.string().min(1),
  existingValue: z.string().min(1),
  newValue: z.string().min(1),
  explanation: z.string().min(1),
});
export type Contradiction = z.infer<typeof ContradictionSchema>;

/** "Ponto a validar" — used instead of guessing when information is missing (spec §18). */
export const ValidationPointSchema = z.object({
  id: z.string(),
  field: z.string().min(1),
  description: z.string().min(1),
  resolved: z.boolean().default(false),
});
export type ValidationPoint = z.infer<typeof ValidationPointSchema>;

export const ProcessModelSchema = z.object({
  identification: IdentificationSchema,
  objective: z.string().nullable().default(null),
  owner: z.string().nullable().default(null),
  trigger: z.string().nullable().default(null),
  endEvent: z.string().nullable().default(null),
  steps: z.array(StepSchema).default([]),
  decisions: z.array(DecisionSchema).default([]),
  exceptions: z.array(ExceptionSchema).default([]),
  businessRules: z.array(BusinessRuleSchema).default([]),
  problems: z.array(ProblemSchema).default([]),
  quickWins: z.array(QuickWinSchema).default([]),
  validationPoints: z.array(ValidationPointSchema).default([]),
  /** Free-text notes that do not fit any structured field above (spec §26 "Observações"). */
  observations: z.array(z.string()).default([]),
  /** Awaiting user confirmation (spec §17) — blocks finishing the interview until resolved. */
  pendingContradictions: z.array(ContradictionSchema).default([]),
});
export type ProcessModel = z.infer<typeof ProcessModelSchema>;

export function createEmptyProcessModel(identification: Identification): ProcessModel {
  return ProcessModelSchema.parse({
    identification,
    steps: [],
    decisions: [],
    exceptions: [],
    businessRules: [],
    problems: [],
    quickWins: [],
    validationPoints: [],
    observations: [],
    pendingContradictions: [],
  });
}

let idCounter = 0;
/** Deterministic, collision-free ids for entities created during a single process run. */
export function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${idCounter}`;
}
