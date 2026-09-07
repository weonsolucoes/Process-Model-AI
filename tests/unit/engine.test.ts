import { describe, expect, it } from "vitest";
import { runInterviewTurn } from "@/lib/interview/engine";
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
