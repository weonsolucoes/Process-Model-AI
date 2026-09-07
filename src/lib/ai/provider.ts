import type { ProcessModel } from "@/domain/processModel";
import type { InterviewTurnResult } from "@/domain/interviewTypes";
import type { AuditResult } from "@/domain/auditTypes";

export interface ConversationTurn {
  role: "user" | "assistant";
  content: string;
}

export interface AIUsage {
  promptTokens: number;
  completionTokens: number;
}

export interface InterviewTurnRequest {
  processModel: ProcessModel;
  /** Prior turns, oldest first. Does not include latestUserMessage. */
  history: ConversationTurn[];
  latestUserMessage: string;
}

export interface InterviewTurnResponse {
  result: InterviewTurnResult;
  usage: AIUsage;
  model: string;
}

export interface AuditResponse {
  result: AuditResult;
  usage: AIUsage;
  model: string;
}

/**
 * Everything the product's intelligence needs from a language model.
 * Interview Engine and AI Auditor depend only on this interface (spec §37,
 * §38) — swapping the underlying model or vendor never touches their logic.
 */
export interface AIProvider {
  runInterviewTurn(req: InterviewTurnRequest): Promise<InterviewTurnResponse>;
  runAudit(processModel: ProcessModel): Promise<AuditResponse>;
}

export class AIProviderError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "AIProviderError";
  }
}
