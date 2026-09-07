import type { ProcessModel } from "@/domain/processModel";
import type { AmbiguityFinding, AuditResult } from "@/domain/auditTypes";
import { AMBIGUITY_MARKERS } from "@/domain/infoHierarchy";
import { checkEssentialCompleteness } from "@/lib/interview/completeness";
import type { AIProvider, AIUsage } from "@/lib/ai/provider";

export interface AuditOutcome {
  result: AuditResult;
  usage: AIUsage;
  aiModel: string;
}

/**
 * The AI Auditor (spec §31-32). The model's judgment call on ambiguity,
 * undefined responsibility, and incomplete decisions is trusted — but
 * `approved` is never true unless the deterministic Level-1 floor also
 * holds, so the auditor can relax on everything secondary without ever
 * rubber-stamping a process that has no clear start, flow, or end.
 */
export async function runAudit(model: ProcessModel, provider: AIProvider): Promise<AuditOutcome> {
  const { result: aiResult, usage, model: aiModel } = await provider.runAudit(model);
  const deterministic = checkEssentialCompleteness(model);

  const ambiguities = dedupeAmbiguities([...aiResult.ambiguities, ...scanForAmbiguousPhrasing(model)]);
  const missingCritical = dedupeStrings([...aiResult.missingCritical, ...deterministic.missing]);

  const result: AuditResult = {
    ...aiResult,
    approved: aiResult.approved && deterministic.complete,
    startClear: aiResult.startClear && !!model.trigger,
    mainFlowClear: aiResult.mainFlowClear && model.steps.length > 0,
    endClear: aiResult.endClear && !!model.endEvent,
    missingCritical,
    ambiguities,
  };

  return { result, usage, aiModel };
}

function scanForAmbiguousPhrasing(model: ProcessModel): AmbiguityFinding[] {
  const findings: AmbiguityFinding[] = [];
  const texts: Array<{ field: string; text: string | null }> = [
    ...model.steps.map((s) => ({ field: `step:${s.id}`, text: s.activity })),
    ...model.decisions.map((d) => ({ field: `decision:${d.id}`, text: d.condition })),
    ...model.exceptions.map((e) => ({ field: `exception:${e.id}`, text: e.description })),
    ...model.businessRules.map((r) => ({ field: `rule:${r.id}`, text: r.rule })),
  ];

  for (const { field, text } of texts) {
    if (!text) continue;
    const lower = text.toLowerCase();
    for (const marker of AMBIGUITY_MARKERS) {
      if (lower.includes(marker)) {
        findings.push({
          quote: text,
          field,
          note: `Expressão ambígua detectada ("${marker}"). Considere esclarecer quem/quando exatamente.`,
        });
      }
    }
  }
  return findings;
}

function dedupeAmbiguities(items: AmbiguityFinding[]): AmbiguityFinding[] {
  const seen = new Set<string>();
  const out: AmbiguityFinding[] = [];
  for (const item of items) {
    const key = `${item.field ?? ""}::${item.quote}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function dedupeStrings(items: string[]): string[] {
  return Array.from(new Set(items));
}
