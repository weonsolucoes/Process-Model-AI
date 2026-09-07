import type { ProcessModel } from "@/domain/processModel";
import { escapeHtml, wrapReportHtml } from "./htmlTemplate";

/**
 * The AS IS deliverable (spec §26). Pure projection of the Process Model —
 * every sentence here traces back to a field the interview actually
 * populated; there is no free-text generation step that could introduce
 * unsupported claims.
 */
export function generateAsIsHtml(model: ProcessModel): string {
  const { identification } = model;

  const overview = buildOverview(model);

  const body = `
<h1>AS IS — ${escapeHtml(identification.processName)}</h1>
<p class="subtitle">Documento gerado automaticamente a partir da entrevista com o WeOn AI Process.</p>

<h2>Identificação</h2>
<table>
  <tr><th>Processo</th><td>${escapeHtml(identification.processName)}</td></tr>
  <tr><th>Área</th><td>${escapeHtml(identification.area ?? "—")}</td></tr>
  <tr><th>Objetivo</th><td>${escapeHtml(model.objective ?? "—")}</td></tr>
  <tr><th>Responsável pelo processo</th><td>${escapeHtml(model.owner ?? "—")}</td></tr>
  <tr><th>Respondente</th><td>${escapeHtml(identification.respondentRole ?? "—")}</td></tr>
</table>

<h2>Visão geral</h2>
<p>${escapeHtml(overview)}</p>

<h2>Fluxo</h2>
${renderStepsTable(model)}

<h2>Decisões</h2>
${renderDecisions(model)}

<h2>Exceções</h2>
${renderExceptions(model)}

<h2>Regras de negócio</h2>
${renderBusinessRules(model)}

<h2>Pontos a validar</h2>
${renderValidationPoints(model)}

<h2>Observações</h2>
${renderObservations(model)}
`;

  return wrapReportHtml(`AS IS — ${identification.processName}`, body);
}

function buildOverview(model: ProcessModel): string {
  const parts: string[] = [];
  parts.push(
    model.trigger
      ? `Este processo é iniciado quando: ${model.trigger}.`
      : "O gatilho de início ainda não foi confirmado (ver Pontos a validar).",
  );
  parts.push(`Ele é composto por ${model.steps.length} etapa(s) principal(is).`);
  if (model.decisions.length > 0) {
    parts.push(`Há ${model.decisions.length} decisão(ões) relevante(s) ao longo do fluxo.`);
  }
  parts.push(
    model.endEvent
      ? `O processo é encerrado quando: ${model.endEvent}.`
      : "O encerramento ainda não foi confirmado (ver Pontos a validar).",
  );
  return parts.join(" ");
}

function renderStepsTable(model: ProcessModel): string {
  if (model.steps.length === 0) return `<p class="empty">Nenhuma etapa registrada.</p>`;
  const rows = model.steps
    .map(
      (s) => `<tr>
        <td>${s.order + 1}</td>
        <td>${escapeHtml(s.activity)}</td>
        <td>${escapeHtml(s.responsible ?? "—")}</td>
        <td>${escapeHtml(s.input ?? "—")}</td>
        <td>${escapeHtml(s.output ?? "—")}</td>
        <td>${escapeHtml(s.systemTool ?? "—")}</td>
      </tr>`,
    )
    .join("\n");
  return `<table>
    <tr><th>#</th><th>Atividade</th><th>Responsável</th><th>Entrada</th><th>Saída</th><th>Sistema/Ferramenta</th></tr>
    ${rows}
  </table>`;
}

function renderDecisions(model: ProcessModel): string {
  if (model.decisions.length === 0) return `<p class="empty">Nenhuma decisão registrada.</p>`;
  return model.decisions
    .map((d) => {
      const paths = d.paths
        .map((p) => `<li><strong>${escapeHtml(p.label)}</strong>${p.description ? `: ${escapeHtml(p.description)}` : ""}</li>`)
        .join("");
      return `<p><strong>${escapeHtml(d.condition)}</strong>${d.responsible ? ` (responsável: ${escapeHtml(d.responsible)})` : ""}</p><ul>${paths}</ul>`;
    })
    .join("\n");
}

function renderExceptions(model: ProcessModel): string {
  if (model.exceptions.length === 0) return `<p class="empty">Nenhuma exceção registrada.</p>`;
  const rows = model.exceptions
    .map(
      (e) => `<tr>
        <td>${escapeHtml(e.description)}</td>
        <td>${escapeHtml(e.condition ?? "—")}</td>
        <td>${escapeHtml(e.treatment ?? "—")}</td>
        <td>${escapeHtml(e.responsible ?? "—")}</td>
      </tr>`,
    )
    .join("\n");
  return `<table><tr><th>Exceção</th><th>Condição</th><th>Tratamento</th><th>Responsável</th></tr>${rows}</table>`;
}

function renderBusinessRules(model: ProcessModel): string {
  if (model.businessRules.length === 0) return `<p class="empty">Nenhuma regra de negócio registrada.</p>`;
  return `<ul>${model.businessRules
    .map(
      (r) =>
        `<li>${escapeHtml(r.rule)}${r.condition ? ` — condição: ${escapeHtml(r.condition)}` : ""}${
          r.consequence ? ` — consequência: ${escapeHtml(r.consequence)}` : ""
        }</li>`,
    )
    .join("")}</ul>`;
}

function renderValidationPoints(model: ProcessModel): string {
  const open = model.validationPoints.filter((v) => !v.resolved);
  if (open.length === 0) return `<p class="empty">Nenhum ponto pendente.</p>`;
  return `<ul>${open.map((v) => `<li><strong>${escapeHtml(v.field)}</strong>: ${escapeHtml(v.description)}</li>`).join("")}</ul>`;
}

function renderObservations(model: ProcessModel): string {
  if (model.observations.length === 0) return `<p class="empty">Nenhuma observação adicional.</p>`;
  return `<ul>${model.observations.map((o) => `<li>${escapeHtml(o)}</li>`).join("")}</ul>`;
}
