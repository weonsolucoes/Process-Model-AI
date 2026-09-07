/**
 * Contract between the Interview Engine and the AI provider for a single
 * conversational turn. The model NEVER returns a full Process Model —
 * only additive, structured "updates" plus a decision about whether to
 * keep asking. Deterministic code (see lib/interview/merge.ts) is what
 * actually writes to the Process Model; this keeps hallucinations
 * contained to "the model proposed a field that isn't grounded in the
 * user's message" (testable) rather than "the model silently rewrote
 * history" (not testable).
 */
import { z } from "zod";
import { ConfidenceSchema, ContradictionSchema, ProblemTypeSchema } from "./processModel";

export { ContradictionSchema };
export type { Contradiction } from "./processModel";

export const InfoLevelSchema = z.enum(["essential", "relevant", "contextual"]);
export type InfoLevel = z.infer<typeof InfoLevelSchema>;

export const NewStepInputSchema = z.object({
  activity: z.string().min(1),
  responsible: z.string().nullable().optional(),
  input: z.string().nullable().optional(),
  output: z.string().nullable().optional(),
  systemTool: z.string().nullable().optional(),
});
export type NewStepInput = z.infer<typeof NewStepInputSchema>;

/**
 * Fills in an attribute (e.g. "responsible") on a step already registered
 * in an earlier turn — the common case of a user answering a follow-up
 * question about something they already described. Matched by activity
 * text, never by a fabricated id, so it can only annotate, never invent,
 * a step.
 */
export const PatchStepInputSchema = z.object({
  stepActivityHint: z.string().min(1),
  responsible: z.string().nullable().optional(),
  input: z.string().nullable().optional(),
  output: z.string().nullable().optional(),
  systemTool: z.string().nullable().optional(),
});
export type PatchStepInput = z.infer<typeof PatchStepInputSchema>;

export const NewDecisionPathInputSchema = z.object({
  label: z.string().min(1),
  description: z.string().nullable().optional(),
  /** Free-text hint matched against step activities to resolve nextStepId deterministically. */
  nextStepActivityHint: z.string().nullable().optional(),
});

export const NewDecisionInputSchema = z.object({
  condition: z.string().min(1),
  responsible: z.string().nullable().optional(),
  paths: z.array(NewDecisionPathInputSchema).default([]),
});
export type NewDecisionInput = z.infer<typeof NewDecisionInputSchema>;

export const NewExceptionInputSchema = z.object({
  description: z.string().min(1),
  condition: z.string().nullable().optional(),
  treatment: z.string().nullable().optional(),
  responsible: z.string().nullable().optional(),
  relatedStepActivityHint: z.string().nullable().optional(),
  returnsToStepActivityHint: z.string().nullable().optional(),
});
export type NewExceptionInput = z.infer<typeof NewExceptionInputSchema>;

export const NewBusinessRuleInputSchema = z.object({
  rule: z.string().min(1),
  condition: z.string().nullable().optional(),
  responsible: z.string().nullable().optional(),
  consequence: z.string().nullable().optional(),
});
export type NewBusinessRuleInput = z.infer<typeof NewBusinessRuleInputSchema>;

export const NewProblemInputSchema = z.object({
  description: z.string().min(1),
  relatedStepActivityHint: z.string().nullable().optional(),
  type: ProblemTypeSchema,
  evidence: z.string().min(1),
  impact: z.string().nullable().optional(),
  frequency: z.string().nullable().optional(),
  confidence: ConfidenceSchema,
});
export type NewProblemInput = z.infer<typeof NewProblemInputSchema>;

export const NewQuickWinInputSchema = z.object({
  opportunity: z.string().min(1),
  relatedProblemDescriptionHint: z.string().nullable().optional(),
  suggestion: z.string().min(1),
  effort: z.enum(["low", "medium", "high"]).nullable().optional(),
  potentialImpact: z.string().nullable().optional(),
  dependencies: z.string().nullable().optional(),
  confidence: ConfidenceSchema.optional(),
});
export type NewQuickWinInput = z.infer<typeof NewQuickWinInputSchema>;

export const NewValidationPointInputSchema = z.object({
  field: z.string().min(1),
  description: z.string().min(1),
});
export type NewValidationPointInput = z.infer<typeof NewValidationPointInputSchema>;

export const TopLevelUpdatesSchema = z.object({
  objective: z.string().nullable().optional(),
  owner: z.string().nullable().optional(),
  trigger: z.string().nullable().optional(),
  endEvent: z.string().nullable().optional(),
});

export const ExtractionUpdateSchema = z.object({
  topLevel: TopLevelUpdatesSchema.default({}),
  addSteps: z.array(NewStepInputSchema).default([]),
  patchSteps: z.array(PatchStepInputSchema).default([]),
  addDecisions: z.array(NewDecisionInputSchema).default([]),
  addExceptions: z.array(NewExceptionInputSchema).default([]),
  addBusinessRules: z.array(NewBusinessRuleInputSchema).default([]),
  addProblems: z.array(NewProblemInputSchema).default([]),
  addQuickWins: z.array(NewQuickWinInputSchema).default([]),
  addValidationPoints: z.array(NewValidationPointInputSchema).default([]),
  addObservations: z.array(z.string()).default([]),
});
export type ExtractionUpdate = z.infer<typeof ExtractionUpdateSchema>;

export const GapSignalSchema = z.object({
  description: z.string().min(1),
  level: InfoLevelSchema,
  potentialImpact: z.string().min(1),
});
export type GapSignal = z.infer<typeof GapSignalSchema>;

/**
 * The full, validated shape the AI provider must return for one interview
 * turn. `decision: "ask"` requires `nextQuestion` + a functional
 * `justification` (spec §11's "economia de cognição" rule); `decision:
 * "finish"` means the model believes operational sufficiency (spec §12)
 * has been reached.
 */
export const InterviewTurnResultSchema = z
  .object({
    update: ExtractionUpdateSchema,
    contradictions: z.array(ContradictionSchema).default([]),
    gapsIdentified: z.array(GapSignalSchema).default([]),
    decision: z.enum(["ask", "finish"]),
    nextQuestion: z.string().nullable().optional(),
    justification: z.string().nullable().optional(),
  })
  .refine((v) => v.decision !== "ask" || !!v.nextQuestion, {
    message: "nextQuestion is required when decision is 'ask'",
  });
export type InterviewTurnResult = z.infer<typeof InterviewTurnResultSchema>;
