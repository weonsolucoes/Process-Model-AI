import type { Problem, ProcessModel } from "@/domain/processModel";
import { escapeHtml, wrapReportHtml } from "./htmlTemplate";

const PROBLEM_TYPE_LABELS: Record<Problem["type"], string> = {
  rework: "Retrabalho",
  waiting: "Espera",
  bottleneck: "Gargalo",
  people_dependency: "Dependência de pessoas",
  duplication: "Duplicidade",
  communication: "Comunicação",
  risk: "Risco",
  unnecessary_step: "Etapa desnecessária",
  lack_of_standardization: "Falta de padronização",
  possible_automation: "Oportunidade de automação",
  other: "Outro",
};

/**
 * The Diagnosis deliverable (spec §28). Renders exactly the `problems[]`
 * the interview already classified as fact vs. hypothesis (spec §22) — the
 * output engine never re-judges or upgrades confidence, it only displays
 * it, keeping "nunca transformar hipótese em fato" true by construction.
 */
export function generateDiagnosisHtml(model: ProcessModel): string {
  const { identification } = model;
  const facts = model.problems.filter((p) => p.confidence === "fact");
  const hypotheses = model.problems.filter((p) => p.confidence === "hypothesis");

  const body = `
<h1>Diagnóstico — ${escapeHtml(identification.processName)}</h1>
<p class="subtitle">Fatos evidenciados e oportunidades/hipóteses identificadas durante a entrevista.</p>

<h2>Fatos evidenciados</h2>
${renderProblemList(facts, "fact")}

<h2>Oportunidades / hipóteses</h2>
${renderProblemList(hypotheses, "hypothesis")}
`;

  return wrapReportHtml(`Diagnóstico — ${identification.processName}`, body);
}

function renderProblemList(problems: Problem[], kind: "fact" | "hypothesis"): string {
  if (problems.length === 0) {
    return `<p class="empty">Nenhum ${kind === "fact" ? "fato evidenciado" : "hipótese"} registrado.</p>`;
  }
  return problems
    .map((p) => {
      const badge = kind === "fact" ? `<span class="badge badge-fact">fato</span>` : `<span class="badge badge-hypothesis">hipótese</span>`;
      return `<div>
        <p>${badge} <strong>${escapeHtml(PROBLEM_TYPE_LABELS[p.type])}</strong> — ${escapeHtml(p.description)}</p>
        <p class="meta">Evidência: "${escapeHtml(p.evidence)}"${p.impact ? ` · Impacto: ${escapeHtml(p.impact)}` : ""}${p.frequency ? ` · Frequência: ${escapeHtml(p.frequency)}` : ""}</p>
      </div>`;
    })
    .join("\n");
}
