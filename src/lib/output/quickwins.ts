import type { ProcessModel, QuickWin } from "@/domain/processModel";
import { escapeHtml, wrapReportHtml } from "./htmlTemplate";

/** Verbatim examples of banned generic phrasing from spec §29 — a safety net, not a rewrite. */
const GENERIC_PHRASES = ["melhorar a comunicação", "investir em tecnologia", "treinar a equipe"];

function isGeneric(suggestion: string): boolean {
  const norm = suggestion.trim().toLowerCase().replace(/\.$/, "");
  return GENERIC_PHRASES.some((phrase) => norm === phrase);
}

/**
 * Quick Wins deliverable (spec §29). The output engine renders exactly
 * what the interview recorded; a suggestion that slipped through as one of
 * the explicitly banned generic phrases is flagged for review rather than
 * silently dropped or rewritten (the model must never invent the missing
 * context on its own).
 */
export function generateQuickWinsHtml(model: ProcessModel): string {
  const { identification } = model;

  const body = `
<h1>Quick Wins — ${escapeHtml(identification.processName)}</h1>
<p class="subtitle">Recomendações práticas fundamentadas no processo mapeado.</p>
${renderQuickWins(model.quickWins)}
`;

  return wrapReportHtml(`Quick Wins — ${identification.processName}`, body);
}

function renderQuickWins(quickWins: QuickWin[]): string {
  if (quickWins.length === 0) return `<p class="empty">Nenhum quick win identificado.</p>`;
  return quickWins
    .map((q) => {
      const flagged = isGeneric(q.suggestion)
        ? `<span class="badge badge-hypothesis">genérico — revisar</span> `
        : "";
      return `<div>
        <p>${flagged}<strong>${escapeHtml(q.opportunity)}</strong></p>
        <p>${escapeHtml(q.suggestion)}</p>
        <p class="meta">${q.effort ? `Esforço: ${escapeHtml(q.effort)}` : ""}${
          q.potentialImpact ? ` · Impacto potencial: ${escapeHtml(q.potentialImpact)}` : ""
        }${q.dependencies ? ` · Dependências: ${escapeHtml(q.dependencies)}` : ""}</p>
      </div>`;
    })
    .join("\n");
}
