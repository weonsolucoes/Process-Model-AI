import { z } from "zod";

/**
 * Output of the AI Auditor (spec §31-32). It must not require perfection —
 * only enough clarity to explain and draw the process. Anything short of
 * that becomes a `validationPoints` entry rather than a hard block.
 */
export const AmbiguityFindingSchema = z.object({
  quote: z.string().min(1),
  field: z.string().nullable().optional(),
  note: z.string().min(1),
});
export type AmbiguityFinding = z.infer<typeof AmbiguityFindingSchema>;

export const AuditResultSchema = z.object({
  approved: z.boolean(),
  startClear: z.boolean(),
  mainFlowClear: z.boolean(),
  endClear: z.boolean(),
  missingCritical: z.array(z.string()).default([]),
  secondaryGaps: z.array(z.string()).default([]),
  undefinedResponsibilities: z.array(z.string()).default([]),
  incompleteDecisions: z.array(z.string()).default([]),
  ambiguities: z.array(AmbiguityFindingSchema).default([]),
  contradictionsFound: z.array(z.string()).default([]),
  summary: z.string().min(1),
});
export type AuditResult = z.infer<typeof AuditResultSchema>;
