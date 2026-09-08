import type { Identification, ProcessModel } from "@/domain/processModel";
import type { AIProvider, AIUsage, ConversationTurn } from "@/lib/ai/provider";
import { checkEssentialCompleteness, defaultQuestionForGap } from "./completeness";
import {
  contradictionToValidationPoint,
  formatContradictionPrompt,
  partitionContradictions,
  resolveNextContradiction,
  stripContradictedFields,
} from "./contradictions";
import { mergeExtractionUpdate } from "./merge";

export interface EngineTurnResult {
  model: ProcessModel;
  assistantMessage: string;
  interviewComplete: boolean;
  usage: AIUsage;
  aiModel: string;
  decisionSummary: string;
}

const NO_USAGE: AIUsage = { promptTokens: 0, completionTokens: 0 };

export function openingQuestion(identification: Identification): string {
  return `Vamos mapear o processo "${identification.processName}". Para começar, me conte o que acontece, passo a passo, do início ao fim.`;
}

/**
 * The Interview Engine's cycle (spec §8): resposta → extração → atualização
 * do Process Model → análise do estado → lacunas → decisão → nova pergunta
 * ou finalização. The AI provider only ever proposes; every branch below
 * that decides whether the interview is *actually* done is deterministic
 * code, not model output — see completeness.ts for why.
 */
export async function runInterviewTurn(
  model: ProcessModel,
  history: ConversationTurn[],
  userMessage: string,
  provider: AIProvider,
): Promise<EngineTurnResult> {
  if (model.pendingContradictions.length > 0) {
    return resolvePendingContradictionTurn(model, userMessage);
  }

  const response = await provider.runInterviewTurn({
    processModel: model,
    history,
    latestUserMessage: userMessage,
  });
  const { result, usage, model: aiModel } = response;

  // Only objective/owner/trigger/endEvent can actually be confirmed and
  // written back (see resolveNextContradiction). A contradiction on any
  // other field would otherwise show a confirmation question whose answer
  // the system has no way to apply — instead it becomes a validationPoint,
  // visible on the validation screen, without blocking the turn.
  const { supported: supportedContradictions, unsupported: unsupportedContradictions } =
    partitionContradictions(result.contradictions);

  const stripped = stripContradictedFields(result.update, supportedContradictions);
  const cleanUpdate = {
    ...stripped,
    addValidationPoints: [
      ...stripped.addValidationPoints,
      ...unsupportedContradictions.map(contradictionToValidationPoint),
    ],
  };
  let merged = mergeExtractionUpdate(model, cleanUpdate);

  if (supportedContradictions.length > 0) {
    merged = {
      ...merged,
      pendingContradictions: [...merged.pendingContradictions, ...supportedContradictions],
    };
    return {
      model: merged,
      assistantMessage: formatContradictionPrompt(supportedContradictions),
      interviewComplete: false,
      usage,
      aiModel,
      decisionSummary: `Contradição detectada em: ${supportedContradictions.map((c) => c.field).join(", ")}.`,
    };
  }

  const { complete, missing } = checkEssentialCompleteness(merged);

  if (result.decision === "finish" && complete) {
    return {
      model: merged,
      assistantMessage:
        "Já tenho uma boa compreensão do processo. Vamos revisar juntos a síntese antes de gerar os materiais?",
      interviewComplete: true,
      usage,
      aiModel,
      decisionSummary: result.justification ?? "Suficiência operacional atingida.",
    };
  }

  const nextQuestion = !complete
    ? defaultQuestionForGap(missing[0] ?? "fluxo principal")
    : (result.nextQuestion ?? defaultQuestionForGap("fluxo principal"));

  return {
    model: merged,
    assistantMessage: nextQuestion,
    interviewComplete: false,
    usage,
    aiModel,
    decisionSummary:
      result.justification ??
      (missing.length > 0 ? `Lacuna essencial: ${missing.join(", ")}` : "Prosseguindo com a entrevista."),
  };
}

function resolvePendingContradictionTurn(model: ProcessModel, userMessage: string): EngineTurnResult {
  const resolved = resolveNextContradiction(model, userMessage);

  if (resolved.pendingContradictions.length > 0) {
    return {
      model: resolved,
      assistantMessage: formatContradictionPrompt(resolved.pendingContradictions),
      interviewComplete: false,
      usage: NO_USAGE,
      aiModel: "n/a",
      decisionSummary: "Resolvendo contradição pendente (restam outras na fila).",
    };
  }

  const { complete, missing } = checkEssentialCompleteness(resolved);
  if (complete) {
    return {
      model: resolved,
      assistantMessage:
        "Obrigado por confirmar. Já tenho o suficiente para montar uma síntese do processo — vamos revisar juntos?",
      interviewComplete: true,
      usage: NO_USAGE,
      aiModel: "n/a",
      decisionSummary: "Contradição resolvida; completude essencial atingida.",
    };
  }

  return {
    model: resolved,
    assistantMessage: defaultQuestionForGap(missing[0] ?? "fluxo principal"),
    interviewComplete: false,
    usage: NO_USAGE,
    aiModel: "n/a",
    decisionSummary: "Contradição resolvida; retomando entrevista.",
  };
}
