import type {
  AIProvider,
  AuditResponse,
  InterviewTurnRequest,
  InterviewTurnResponse,
} from "@/lib/ai/provider";
import type { InterviewTurnResult } from "@/domain/interviewTypes";
import type { AuditResult } from "@/domain/auditTypes";
import type { ProcessModel } from "@/domain/processModel";

/**
 * A scripted AIProvider test double. Unlike the app's HeuristicProvider
 * (a real, if crude, fallback used at runtime), this exists purely so unit
 * tests can assert on the Interview Engine / Auditor's own logic — merge,
 * completeness gating, contradiction handling — against an exact, known
 * "model response" instead of a live, non-deterministic LLM call.
 */
export class FixtureProvider implements AIProvider {
  private turnIndex = 0;
  private auditIndex = 0;

  constructor(
    private readonly turns: InterviewTurnResult[] = [],
    private readonly audits: AuditResult[] = [],
  ) {}

  async runInterviewTurn(_req: InterviewTurnRequest): Promise<InterviewTurnResponse> {
    const result = this.turns[this.turnIndex];
    if (!result) {
      throw new Error(`FixtureProvider: no scripted turn for index ${this.turnIndex}`);
    }
    this.turnIndex += 1;
    return { result, usage: { promptTokens: 10, completionTokens: 20 }, model: "fixture-v1" };
  }

  async runAudit(_processModel: ProcessModel): Promise<AuditResponse> {
    const result = this.audits[this.auditIndex];
    if (!result) {
      throw new Error(`FixtureProvider: no scripted audit for index ${this.auditIndex}`);
    }
    this.auditIndex += 1;
    return { result, usage: { promptTokens: 10, completionTokens: 20 }, model: "fixture-v1" };
  }
}

export function turn(partial: Partial<InterviewTurnResult> & { decision: "ask" | "finish" }): InterviewTurnResult {
  return {
    update: {
      topLevel: {},
      addSteps: [],
      patchSteps: [],
      addDecisions: [],
      addExceptions: [],
      addBusinessRules: [],
      addProblems: [],
      addQuickWins: [],
      addValidationPoints: [],
      addObservations: [],
      ...partial.update,
    },
    contradictions: partial.contradictions ?? [],
    gapsIdentified: partial.gapsIdentified ?? [],
    decision: partial.decision,
    nextQuestion: partial.nextQuestion ?? (partial.decision === "ask" ? "Pergunta?" : null),
    justification: partial.justification ?? null,
  };
}

export function audit(partial: Partial<AuditResult>): AuditResult {
  return {
    approved: partial.approved ?? true,
    startClear: partial.startClear ?? true,
    mainFlowClear: partial.mainFlowClear ?? true,
    endClear: partial.endClear ?? true,
    missingCritical: partial.missingCritical ?? [],
    secondaryGaps: partial.secondaryGaps ?? [],
    undefinedResponsibilities: partial.undefinedResponsibilities ?? [],
    incompleteDecisions: partial.incompleteDecisions ?? [],
    ambiguities: partial.ambiguities ?? [],
    contradictionsFound: partial.contradictionsFound ?? [],
    summary: partial.summary ?? "ok",
  };
}
