import { describe, expect, it } from "vitest";
import { runInterviewTurn } from "@/lib/interview/engine";
import { HeuristicProvider } from "@/lib/ai/heuristicProvider";
import type { ConversationTurn } from "@/lib/ai/provider";
import { FixtureProvider, turn } from "../support/fixtureProvider";
import { makeEmptyModel } from "../support/factories";

describe("Interview Engine cycle (spec §8-9, §43 test cases)", () => {
  it("Caso 1 — simple linear process: finishes once the AI says so and the essential floor holds", async () => {
    const model = makeEmptyModel();
    const provider = new FixtureProvider([
      turn({
        decision: "finish",
        update: {
          topLevel: { trigger: "Estoque baixo", endEvent: "Pedido recebido" },
          addSteps: [{ activity: "Verificar preço", responsible: "Ana" }, { activity: "Fazer pedido" }],
        },
      }),
    ]);

    const outcome = await runInterviewTurn(model, [], "Quando o estoque acaba, verificamos o preço e fazemos o pedido.", provider);

    expect(outcome.interviewComplete).toBe(true);
    expect(outcome.model.steps).toHaveLength(2);
  });

  it("Caso 2 — process with a decision: both paths are recorded explicitly, not as generic text", async () => {
    const model = makeEmptyModel();
    const provider = new FixtureProvider([
      turn({
        decision: "finish",
        update: {
          topLevel: { trigger: "Estoque baixo", endEvent: "Pedido recebido" },
          addSteps: [{ activity: "Verificar preço" }],
          addDecisions: [
            {
              condition: "Preço está na faixa esperada?",
              responsible: null,
              paths: [
                { label: "Sim", description: "Compra a quantidade padrão", nextStepActivityHint: null },
                { label: "Não", description: "Consulta o gerente", nextStepActivityHint: null },
              ],
            },
          ],
        },
      }),
    ]);

    const outcome = await runInterviewTurn(model, [], "Se o preço estiver na faixa, compramos; senão, consultamos o gerente.", provider);

    expect(outcome.model.decisions).toHaveLength(1);
    expect(outcome.model.decisions[0]?.paths).toHaveLength(2);
    expect(outcome.model.decisions[0]?.paths.map((p) => p.label)).toEqual(["Sim", "Não"]);
  });

  it("safety net: never finishes just because the AI says so if the essential floor still fails (spec §12/§32)", async () => {
    const model = makeEmptyModel();
    const provider = new FixtureProvider([
      turn({
        decision: "finish", // the AI is wrong here — no endEvent yet
        update: { topLevel: { trigger: "Estoque baixo" }, addSteps: [{ activity: "Verificar preço" }] },
        justification: "Tudo certo.",
      }),
    ]);

    const outcome = await runInterviewTurn(model, [], "Quando o estoque acaba, verificamos o preço.", provider);

    expect(outcome.interviewComplete).toBe(false);
    expect(outcome.assistantMessage).toMatch(/encerr/i);
  });

  it("Caso 5 — contradiction: does not silently pick a version, and does not call the AI again until the user resolves it", async () => {
    const model = makeEmptyModel();
    model.trigger = "Estoque baixo";
    const provider = new FixtureProvider([
      turn({
        decision: "ask",
        contradictions: [
          { field: "trigger", existingValue: "Estoque baixo", newValue: "Pedido do cliente", explanation: "o gatilho mudou" },
        ],
      }),
    ]);

    const firstOutcome = await runInterviewTurn(model, [], "Na verdade começa quando chega um pedido do cliente.", provider);
    expect(firstOutcome.model.pendingContradictions).toHaveLength(1);
    expect(firstOutcome.model.trigger).toBe("Estoque baixo"); // untouched until confirmed
    expect(firstOutcome.interviewComplete).toBe(false);

    // Second turn: the engine must resolve from the user's answer directly,
    // WITHOUT invoking the (now-exhausted) FixtureProvider turn script.
    const secondOutcome = await runInterviewTurn(firstOutcome.model, [], "a segunda, isso mesmo", provider);
    expect(secondOutcome.model.trigger).toBe("Pedido do cliente");
    expect(secondOutcome.model.pendingContradictions).toHaveLength(0);
  });

  it("Caso 6 — exception: recorded only with what was said, linked to the step it can occur during", async () => {
    const model = makeEmptyModel();
    const provider = new FixtureProvider([
      turn({
        decision: "finish",
        update: {
          topLevel: { trigger: "Estoque baixo", endEvent: "Pedido recebido" },
          addSteps: [{ activity: "Verificar fornecedor" }],
          addExceptions: [
            {
              description: "Fornecedor está sem o produto",
              condition: "produto indisponível",
              treatment: "buscar fornecedor alternativo",
              responsible: null,
              relatedStepActivityHint: "Verificar fornecedor",
              returnsToStepActivityHint: null,
            },
          ],
        },
      }),
    ]);

    const outcome = await runInterviewTurn(model, [], "Às vezes o fornecedor não tem o produto, aí buscamos outro.", provider);
    expect(outcome.model.exceptions).toHaveLength(1);
    expect(outcome.model.exceptions[0]?.relatedStepId).toBe(outcome.model.steps[0]?.id);
  });

  it("Caso 7 — explicit problem is recorded as fact with the evidence that grounds it", async () => {
    const model = makeEmptyModel();
    const provider = new FixtureProvider([
      turn({
        decision: "ask",
        update: {
          addProblems: [
            {
              description: "Não existe sistema formal de controle de estoque",
              relatedStepActivityHint: null,
              type: "lack_of_standardization",
              evidence: "controlamos tudo de cabeça mesmo, sem planilha",
              impact: null,
              frequency: null,
              confidence: "fact",
            },
          ],
        },
      }),
    ]);

    const outcome = await runInterviewTurn(model, [], "Controlamos tudo de cabeça mesmo, sem planilha.", provider);
    expect(outcome.model.problems[0]?.confidence).toBe("fact");
    expect(outcome.model.problems[0]?.evidence).toContain("de cabeça");
  });

  it("Caso 8 — extremely terse user answers still advance the model without crashing", async () => {
    const model = makeEmptyModel();
    const provider = new FixtureProvider([
      turn({ decision: "ask", update: { topLevel: { trigger: "Pedido do cliente" } } }),
    ]);
    const outcome = await runInterviewTurn(model, [], "Pedido.", provider);
    expect(outcome.model.trigger).toBe("Pedido do cliente");
  });

  it("Caso 9 — extremely detailed user answers can add many steps in a single turn", async () => {
    const model = makeEmptyModel();
    const manySteps = Array.from({ length: 8 }, (_, i) => ({ activity: `Etapa detalhada ${i + 1}` }));
    const provider = new FixtureProvider([
      turn({ decision: "ask", update: { topLevel: { trigger: "Pedido" }, addSteps: manySteps } }),
    ]);
    const outcome = await runInterviewTurn(model, [], "um relato muito longo...", provider);
    expect(outcome.model.steps).toHaveLength(8);
  });

  it("Caso 10 — an out-of-order narration leaves an unresolved link as 'a definir' rather than guessing", async () => {
    const model = makeEmptyModel();
    const provider = new FixtureProvider([
      turn({
        decision: "ask",
        update: {
          topLevel: { trigger: "Estoque baixo" },
          addDecisions: [
            {
              condition: "Preço ok?",
              responsible: null,
              paths: [{ label: "Não", description: null, nextStepActivityHint: "Consultar gerente" }],
            },
          ],
        },
      }),
      turn({
        decision: "finish",
        update: { topLevel: { endEvent: "Pedido recebido" }, addSteps: [{ activity: "Consultar gerente" }] },
      }),
    ]);

    const first = await runInterviewTurn(model, [], "Se o preço não estiver ok, consultamos o gerente depois.", provider);
    expect(first.model.decisions[0]?.paths[0]?.nextStepId).toBeNull();

    const second = await runInterviewTurn(first.model, [], "Ah, e o processo consiste em: consultar o gerente quando necessário.", provider);
    // The step now exists, but the earlier decision path was resolved at
    // merge time and is not retroactively rewired — a known, documented
    // limitation rather than a silent guess.
    expect(second.model.decisions[0]?.paths[0]?.nextStepId).toBeNull();
    expect(second.model.steps.some((s) => s.activity === "Consultar gerente")).toBe(true);
  });
});

describe("unnecessary-questions guard (spec §45)", () => {
  it("does not ask again once the AI + deterministic floor both agree the interview is done", async () => {
    const model = makeEmptyModel();
    const provider = new FixtureProvider([
      turn({
        decision: "finish",
        update: {
          topLevel: { trigger: "Estoque baixo", endEvent: "Pedido recebido" },
          addSteps: [{ activity: "Fazer pedido" }],
        },
      }),
    ]);
    const outcome = await runInterviewTurn(model, [], "Quando acaba o estoque, fazemos o pedido e pronto.", provider);
    expect(outcome.interviewComplete).toBe(true);
    // The engine's own next call for this process must be a fresh AI turn
    // (finished, not another forced fallback question) — the sole assertion
    // that actually matters here is that nothing kept the interview open.
  });
});

describe("regression: completeness priority order (spec §10)", () => {
  it("does not swap a responsibility answer into endEvent or an ending answer into responsible, against the real HeuristicProvider", async () => {
    // Reproduces, turn for turn, the purchasing-process audit simulation
    // that exposed the bug: before the fix, the deterministic floor asked
    // about "encerramento/fim" before "responsáveis", so the user's answer
    // about who is responsible got recorded as the end event, and the
    // answer about the end event got smeared across every step's
    // `responsible` field instead.
    const provider = new HeuristicProvider();
    let model = makeEmptyModel();
    let history: ConversationTurn[] = [];

    const turns = [
      "O estoque é verificado visualmente uma ou duas vezes por semana. Produtos com estoque baixo são identificados.",
      "O comprador informa o gerente. O gerente decide produtos e quantidades. A compra é feita presencialmente.",
      "O comprador é responsável pela verificação e pela compra. O gerente é responsável pela decisão.",
      "O processo termina quando os produtos são colocados na prateleira.",
    ];

    let last;
    for (const message of turns) {
      last = await runInterviewTurn(model, history, message, provider);
      history = [...history, { role: "user", content: message }, { role: "assistant", content: last.assistantMessage }];
      model = last.model;
      if (last.interviewComplete) break;
    }

    expect(last!.interviewComplete).toBe(true);
    expect(model.endEvent).toContain("prateleira");
    expect(model.endEvent).not.toContain("responsável");
    for (const step of model.steps) {
      expect(step.responsible).not.toContain("termina quando");
    }
  });
});

describe("regression: unsupported contradictions become a validationPoint (spec §17)", () => {
  it("does not block the turn on a contradiction the system can't apply, and records it as a validationPoint instead", async () => {
    const model = makeEmptyModel();
    model.trigger = "Estoque baixo";
    model.endEvent = "Pedido recebido";
    model.steps = [
      { id: "s1", activity: "Verificar preço", responsible: "Ana", input: null, output: null, systemTool: null, order: 0, nextStepId: null, decisionId: null },
    ];

    const provider = new FixtureProvider([
      turn({
        decision: "finish",
        contradictions: [
          {
            field: "step.responsible",
            existingValue: "Ana",
            newValue: "Carlos",
            explanation: "o responsável pela etapa mudou",
          },
        ],
      }),
    ]);

    const outcome = await runInterviewTurn(model, [], "Na verdade quem verifica o preço é o Carlos.", provider);

    // Not blocked: no pending confirmation left dangling for a field the
    // system has no way to write back.
    expect(outcome.model.pendingContradictions).toHaveLength(0);
    // Visible instead as a validation point, not silently dropped.
    expect(outcome.model.validationPoints).toHaveLength(1);
    expect(outcome.model.validationPoints[0]?.field).toBe("step.responsible");
    expect(outcome.model.validationPoints[0]?.description).toContain("Ana");
    expect(outcome.model.validationPoints[0]?.description).toContain("Carlos");
    // The original (unconfirmed) value is left untouched — never overwritten silently.
    expect(outcome.model.steps[0]?.responsible).toBe("Ana");
  });
});
