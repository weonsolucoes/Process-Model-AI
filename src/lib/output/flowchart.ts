import type { ProcessModel } from "@/domain/processModel";

/**
 * Programmatically derives a Mermaid flowchart definition from the Process
 * Model — never an image freely invented by the AI (spec §27). Every node
 * and edge below is a direct, traceable projection of steps/decisions/
 * exceptions already present in the model.
 */
export function generateFlowchartMermaid(model: ProcessModel): string {
  const lines: string[] = ["flowchart TD"];

  lines.push(`  start((("Início"))):::startEnd`);
  lines.push(`  end_node((("Fim"))):::startEnd`);

  if (model.steps.length === 0) {
    lines.push(`  start --> end_node`);
    return finalize(lines);
  }

  const first = model.steps[0];
  if (first) {
    lines.push(`  start --> ${first.id}`);
  }

  for (const step of model.steps) {
    const label = [step.activity, step.responsible ? `(${step.responsible})` : null]
      .filter(Boolean)
      .join("<br/>");
    lines.push(`  ${step.id}["${escapeLabel(label)}"]`);

    if (!step.decisionId) {
      const target = step.nextStepId ?? "end_node";
      lines.push(`  ${step.id} --> ${target}`);
    }
  }

  for (const decision of model.decisions) {
    lines.push(`  ${decision.id}{"${escapeLabel(decision.condition)}"}`);
    if (decision.afterStepId) {
      lines.push(`  ${decision.afterStepId} --> ${decision.id}`);
    }
    decision.paths.forEach((path, index) => {
      const targetId = path.nextStepId ?? `${decision.id}_pending_${index}`;
      if (!path.nextStepId) {
        lines.push(`  ${targetId}["(a definir)"]:::pending`);
      }
      lines.push(`  ${decision.id} -->|${escapeLabel(path.label)}| ${targetId}`);
    });
  }

  for (const exception of model.exceptions) {
    if (!exception.relatedStepId) continue;
    const excId = `exc_${exception.id}`;
    lines.push(`  ${excId}["⚠ ${escapeLabel(exception.description)}"]:::exception`);
    lines.push(`  ${exception.relatedStepId} -.-> ${excId}`);
    if (exception.returnsToStepId) {
      lines.push(`  ${excId} -.-> ${exception.returnsToStepId}`);
    }
  }

  return finalize(lines);
}

function finalize(lines: string[]): string {
  lines.push("  classDef startEnd fill:#1f2937,color:#fff,stroke:#1f2937;");
  lines.push("  classDef pending fill:#fff7ed,color:#9a3412,stroke:#f97316,stroke-dasharray: 4 3;");
  lines.push("  classDef exception fill:#fef2f2,color:#991b1b,stroke:#ef4444,stroke-dasharray: 2 2;");
  return lines.join("\n");
}

function escapeLabel(text: string): string {
  return text.replace(/"/g, "'").replace(/\r?\n/g, " ").trim();
}
