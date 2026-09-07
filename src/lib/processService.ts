import type { Process } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ProcessModelSchema, type ProcessModel } from "@/domain/processModel";
import { NotFoundError } from "@/lib/apiHelpers";
import type { AIUsage } from "@/lib/ai/provider";
import { estimateCostUsd } from "@/lib/pricing";
import type { InteractionKind } from "@prisma/client";

/**
 * Loads a process and enforces isolation (spec §40): a process that
 * belongs to a different user is reported as not found, never as
 * forbidden — existence itself is not something to leak cross-user.
 */
export async function loadOwnedProcess(userId: string, processId: string): Promise<Process> {
  const process = await prisma.process.findUnique({ where: { id: processId } });
  if (!process || process.userId !== userId) {
    throw new NotFoundError("Processo não encontrado");
  }
  return process;
}

export function parseModel(process: Process): ProcessModel {
  return ProcessModelSchema.parse(process.modelJson);
}

export async function logAIInteraction(params: {
  processId: string;
  kind: InteractionKind;
  model: string;
  usage: AIUsage;
  decisionSummary?: string | null;
  errorMessage?: string | null;
}): Promise<void> {
  await prisma.aIInteractionLog.create({
    data: {
      processId: params.processId,
      kind: params.kind,
      model: params.model,
      promptTokens: params.usage.promptTokens,
      completionTokens: params.usage.completionTokens,
      costEstimateUsd: estimateCostUsd(params.model, params.usage),
      decisionSummary: params.decisionSummary ?? null,
      errorMessage: params.errorMessage ?? null,
    },
  });
}
