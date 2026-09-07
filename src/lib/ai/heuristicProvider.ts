import type { ProcessModel } from "@/domain/processModel";
import type { ExtractionUpdate } from "@/domain/interviewTypes";
import { checkEssentialCompleteness, defaultQuestionForGap } from "@/lib/interview/completeness";
import { mergeExtractionUpdate } from "@/lib/interview/merge";
import type {
  AIProvider,
  AuditResponse,
  InterviewTurnRequest,
  InterviewTurnResponse,
} from "./provider";

function emptyUpdate(): ExtractionUpdate {
  return {
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
  };
}

/**
 * A deterministic, zero-cost, keyword/rule based stand-in for a real
 * language model. It is NOT meant to demonstrate NLU quality — it exists
 * so the product still runs end-to-end (spec §48 e2e flow) when no
 * ANTHROPIC_API_KEY is configured, and so local development never
 * requires paid API calls. Swap AI_PROVIDER=anthropic (with a key) for the
 * real Interview Engine intelligence described in the spec.
 *
 * Unlike a real model it never infers ahead of the question actually
 * asked — it reacts to whichever essential gap `checkEssentialCompleteness`
 * says is still open, which keeps it convergent (it never asks the same
 * question forever) at the cost of understanding only one gap per turn.
 */
export class HeuristicProvider implements AIProvider {
  async runInterviewTurn(req: InterviewTurnRequest): Promise<InterviewTurnResponse> {
    const message = req.latestUserMessage.trim();
    const model = req.processModel;
    const { missing: missingBefore } = checkEssentialCompleteness(model);
    const primaryGap = missingBefore[0];

    const update = emptyUpdate();

    if (primaryGap === "gatilho/início") {
      update.topLevel.trigger = message;
    } else if (primaryGap === "fluxo principal") {
      for (const clause of splitClauses(message)) {
        if (isDecisionClause(clause)) {
          update.addDecisions.push(parseDecisionClause(clause));
        } else {
          update.addSteps.push({ activity: clause });
        }
      }
    } else if (primaryGap === "responsáveis") {
      for (const step of model.steps) {
        if (!step.responsible) {
          update.patchSteps.push({ stepActivityHint: step.activity, responsible: message });
        }
      }
    } else if (primaryGap === "encerramento/fim") {
      update.topLevel.endEvent = message;
    } else {
      update.addObservations.push(message);
    }

    const projected = mergeExtractionUpdate(model, update);
    const { complete, missing } = checkEssentialCompleteness(projected);

    if (complete) {
      return {
        result: {
          update,
          contradictions: [],
          gapsIdentified: [],
          decision: "finish",
          nextQuestion: null,
          justification: "Fluxo principal, responsáveis e encerramento já estão claros.",
        },
        usage: { promptTokens: 0, completionTokens: 0 },
        model: "heuristic-v1",
      };
    }

    return {
      result: {
        update,
        contradictions: [],
        gapsIdentified: missing.map((m) => ({
          description: m,
          level: "essential",
          potentialImpact: "Necessário para representar o fluxo principal.",
        })),
        decision: "ask",
        nextQuestion: defaultQuestionForGap(missing[0] ?? "fluxo principal"),
        justification: `Ainda falta esclarecer: ${missing.join(", ")}.`,
      },
      usage: { promptTokens: 0, completionTokens: 0 },
      model: "heuristic-v1",
    };
  }

  async runAudit(processModel: ProcessModel): Promise<AuditResponse> {
    const { complete, missing } = checkEssentialCompleteness(processModel);
    return {
      result: {
        approved: complete,
        startClear: !!processModel.trigger,
        mainFlowClear: processModel.steps.length > 0,
        endClear: !!processModel.endEvent,
        missingCritical: missing,
        secondaryGaps: [],
        undefinedResponsibilities: processModel.steps
          .filter((s) => !s.responsible)
          .map((s) => s.activity),
        incompleteDecisions: processModel.decisions
          .filter((d) => d.paths.length < 2)
          .map((d) => d.condition),
        ambiguities: [],
        contradictionsFound: [],
        summary: complete
          ? "Processo suficientemente compreendido para geração dos entregáveis."
          : `Faltam itens essenciais: ${missing.join(", ")}.`,
      },
      usage: { promptTokens: 0, completionTokens: 0 },
      model: "heuristic-v1",
    };
  }
}

function splitClauses(message: string): string[] {
  return message
    .split(/(?:\.\s+|;\s+|\n+|,?\s+(?:depois|em seguida|então|posteriormente|por fim)\s+)/i)
    .map((c) => c.trim())
    .filter((c) => c.length > 3);
}

function isDecisionClause(clause: string): boolean {
  return /^(se|quando|caso)\s/i.test(clause);
}

function parseDecisionClause(clause: string) {
  const [conditionPart, ...rest] = clause.split(/,?\s+sen[ãa]o\s*,?\s*/i);
  return {
    condition: (conditionPart ?? clause).trim(),
    responsible: null,
    paths:
      rest.length > 0
        ? [
            { label: "Sim", description: (conditionPart ?? clause).trim(), nextStepActivityHint: null },
            { label: "Não", description: rest.join(" ").trim(), nextStepActivityHint: null },
          ]
        : [
            { label: "Sim", description: null, nextStepActivityHint: null },
            { label: "Não", description: null, nextStepActivityHint: null },
          ],
  };
}
