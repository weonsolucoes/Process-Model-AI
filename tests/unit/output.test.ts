import { describe, expect, it } from "vitest";
import { generateAsIsHtml } from "@/lib/output/asis";
import { generateDiagnosisHtml } from "@/lib/output/diagnosis";
import { generateQuickWinsHtml } from "@/lib/output/quickwins";
import { generateFlowchartMermaid } from "@/lib/output/flowchart";
import { makeEmptyModel } from "../support/factories";

describe("Output Engine — AS IS (spec §26, §47)", () => {
  it("renders only what is in the Process Model — nothing invented (spec §44 at the output layer)", () => {
    const model = makeEmptyModel();
    model.trigger = "Estoque baixo";
    model.endEvent = "Pedido recebido";
    model.steps = [
      { id: "s1", activity: "Verificar preço", responsible: "Ana", input: null, output: null, systemTool: null, order: 0, nextStepId: null, decisionId: null },
    ];

    const html = generateAsIsHtml(model);

    expect(html).toContain("Verificar preço");
    expect(html).toContain("Ana");
    expect(html).toContain("Estoque baixo");
    // A detail never mentioned anywhere in the model must never surface in the output.
    expect(html).not.toContain("Carlos");
    expect(html).not.toMatch(/sistema\s+erp/i);
  });

  it("shows unresolved fields as pending rather than fabricating them", () => {
    const model = makeEmptyModel();
    const html = generateAsIsHtml(model);
    expect(html).toMatch(/ainda não foi confirmad/i);
  });

  it("surfaces open validation points and hides resolved ones", () => {
    const model = makeEmptyModel();
    model.validationPoints = [
      { id: "v1", field: "responsável", description: "Quem aprova o pedido final?", resolved: false },
      { id: "v2", field: "sistema", description: "Qual ERP é usado?", resolved: true },
    ];
    const html = generateAsIsHtml(model);
    expect(html).toContain("Quem aprova o pedido final?");
    expect(html).not.toContain("Qual ERP é usado?");
  });
});

describe("Output Engine — Diagnosis (spec §22, §28)", () => {
  it("never renders a hypothesis under the facts section (fact vs hypothesis, spec §22 critical rule)", () => {
    const model = makeEmptyModel();
    model.problems = [
      {
        id: "p1",
        description: "Não existe sistema formal de controle de estoque",
        processStepId: null,
        type: "lack_of_standardization",
        evidence: "controlamos de cabeça",
        impact: null,
        frequency: null,
        confidence: "fact",
      },
      {
        id: "p2",
        description: "Isso pode gerar dependência da verificação visual",
        processStepId: null,
        type: "risk",
        evidence: "inferência a partir do relato",
        impact: null,
        frequency: null,
        confidence: "hypothesis",
      },
    ];

    const html = generateDiagnosisHtml(model);
    const factsSection = html.split("Oportunidades / hipóteses")[0]!;
    expect(factsSection).toContain("controle de estoque");
    expect(factsSection).not.toContain("dependência da verificação visual");
  });
});

describe("Output Engine — Quick Wins (spec §29)", () => {
  it("flags a banned generic suggestion instead of presenting it as sound advice", () => {
    const model = makeEmptyModel();
    model.quickWins = [
      {
        id: "q1",
        opportunity: "Falta de padronização",
        relatedProblemId: null,
        suggestion: "Melhorar a comunicação.",
        effort: null,
        potentialImpact: null,
        dependencies: null,
        confidence: "hypothesis",
      },
    ];
    const html = generateQuickWinsHtml(model);
    expect(html).toMatch(/genérico/i);
  });

  it("renders a specific, contextualized suggestion without any generic-flag badge", () => {
    const model = makeEmptyModel();
    model.quickWins = [
      {
        id: "q1",
        opportunity: "Falta de padronização na verificação de preço",
        relatedProblemId: null,
        suggestion: "Criar uma tabela de referência de preços por fornecedor para acelerar a verificação.",
        effort: "low",
        potentialImpact: null,
        dependencies: null,
        confidence: "hypothesis",
      },
    ];
    const html = generateQuickWinsHtml(model);
    expect(html).not.toMatch(/genérico/i);
  });
});

describe("Output Engine — Flowchart (spec §27)", () => {
  it("is generated programmatically and stays consistent with the Process Model's steps/decisions", () => {
    const model = makeEmptyModel();
    model.steps = [
      { id: "s1", activity: "Verificar preço", responsible: null, input: null, output: null, systemTool: null, order: 0, nextStepId: null, decisionId: "d1" },
    ];
    model.decisions = [
      {
        id: "d1",
        afterStepId: "s1",
        condition: "Preço ok?",
        responsible: null,
        paths: [
          { label: "Sim", description: null, nextStepId: null },
          { label: "Não", description: null, nextStepId: null },
        ],
      },
    ];

    const mermaid = generateFlowchartMermaid(model);
    expect(mermaid).toContain("Verificar preço");
    expect(mermaid).toContain("Preço ok?");
    expect(mermaid).toContain("-->|Sim|");
    expect(mermaid).toContain("-->|Não|");
    // Unresolved paths render as an explicit "pending" node, never silently wired to Fim.
    expect(mermaid).toMatch(/a definir/);
  });

  it("renders an empty process as a direct início → fim edge, never a fabricated flow", () => {
    const model = makeEmptyModel();
    const mermaid = generateFlowchartMermaid(model);
    expect(mermaid).toContain("start --> end_node");
  });
});
