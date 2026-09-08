import { describe, expect, it } from "vitest";
import { mergeExtractionUpdate } from "@/lib/interview/merge";
import { makeEmptyModel } from "../support/factories";
import type { ExtractionUpdate } from "@/domain/interviewTypes";

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

describe("mergeExtractionUpdate — anti-hallucination boundary (spec §44)", () => {
  it("never writes a field that wasn't present in the update", () => {
    const model = makeEmptyModel();
    const update = emptyUpdate();
    update.addSteps.push({ activity: "Verificar estoque" });

    const merged = mergeExtractionUpdate(model, update);

    expect(merged.steps).toHaveLength(1);
    expect(merged.steps[0]?.activity).toBe("Verificar estoque");
    // Nothing beyond what was in the update should appear.
    expect(merged.trigger).toBeNull();
    expect(merged.endEvent).toBeNull();
    expect(merged.decisions).toHaveLength(0);
    expect(merged.problems).toHaveLength(0);
  });

  it("preserves all prior data untouched when merging a new, unrelated update", () => {
    const model = makeEmptyModel();
    const first = emptyUpdate();
    first.topLevel.trigger = "Estoque baixo";
    const afterFirst = mergeExtractionUpdate(model, first);

    const second = emptyUpdate();
    second.addSteps.push({ activity: "Fazer pedido" });
    const afterSecond = mergeExtractionUpdate(afterFirst, second);

    expect(afterSecond.trigger).toBe("Estoque baixo");
    expect(afterSecond.steps.map((s) => s.activity)).toEqual(["Fazer pedido"]);
  });

  it("does not overwrite an already-set top-level field with a new one (contradictions must go through confirmation)", () => {
    const model = makeEmptyModel();
    const first = emptyUpdate();
    first.topLevel.trigger = "Estoque baixo";
    const afterFirst = mergeExtractionUpdate(model, first);

    const second = emptyUpdate();
    second.topLevel.trigger = "Pedido do cliente";
    const afterSecond = mergeExtractionUpdate(afterFirst, second);

    expect(afterSecond.trigger).toBe("Estoque baixo");
  });

  it("assigns ids and links steps sequentially by order", () => {
    const model = makeEmptyModel();
    const update = emptyUpdate();
    update.addSteps.push({ activity: "Passo 1" }, { activity: "Passo 2" }, { activity: "Passo 3" });
    const merged = mergeExtractionUpdate(model, update);

    expect(merged.steps).toHaveLength(3);
    expect(merged.steps[0]?.nextStepId).toBe(merged.steps[1]?.id);
    expect(merged.steps[1]?.nextStepId).toBe(merged.steps[2]?.id);
    expect(merged.steps[2]?.nextStepId).toBeNull();
  });

  it("patchSteps only fills null attributes on an existing step, matched by activity — never invents a new step", () => {
    const model = makeEmptyModel();
    const step1 = emptyUpdate();
    step1.addSteps.push({ activity: "Verificar estoque" });
    const afterStep = mergeExtractionUpdate(model, step1);

    const patch = emptyUpdate();
    patch.patchSteps.push({ stepActivityHint: "Verificar estoque", responsible: "Carlos" });
    const afterPatch = mergeExtractionUpdate(afterStep, patch);

    expect(afterPatch.steps).toHaveLength(1);
    expect(afterPatch.steps[0]?.responsible).toBe("Carlos");
  });

  it("patchSteps never overwrites a responsible that's already set", () => {
    const model = makeEmptyModel();
    const step1 = emptyUpdate();
    step1.addSteps.push({ activity: "Verificar estoque", responsible: "Ana" });
    const afterStep = mergeExtractionUpdate(model, step1);

    const patch = emptyUpdate();
    patch.patchSteps.push({ stepActivityHint: "Verificar estoque", responsible: "Carlos" });
    const afterPatch = mergeExtractionUpdate(afterStep, patch);

    expect(afterPatch.steps[0]?.responsible).toBe("Ana");
  });

  it("patchSteps with no matching step is a no-op, not an invented step", () => {
    const model = makeEmptyModel();
    const patch = emptyUpdate();
    patch.patchSteps.push({ stepActivityHint: "Etapa inexistente", responsible: "Carlos" });
    const merged = mergeExtractionUpdate(model, patch);

    expect(merged.steps).toHaveLength(0);
  });

  it("links a decision path to a step by fuzzy activity-text match within the same turn", () => {
    const model = makeEmptyModel();
    const update = emptyUpdate();
    update.addSteps.push({ activity: "Verificar preço no site do fornecedor" }, { activity: "Consultar gerente" });
    update.addDecisions.push({
      condition: "Preço está dentro da faixa?",
      responsible: null,
      paths: [
        { label: "Sim", description: null, nextStepActivityHint: null },
        { label: "Não", description: null, nextStepActivityHint: "Consultar gerente" },
      ],
    });

    const merged = mergeExtractionUpdate(model, update);
    const decision = merged.decisions[0];
    const consultStep = merged.steps.find((s) => s.activity === "Consultar gerente");

    expect(decision?.paths[1]?.nextStepId).toBe(consultStep?.id);
    expect(decision?.afterStepId).toBe(merged.steps[1]?.id);
    // The step the decision was attached to should not also have a linear nextStepId.
    expect(merged.steps[1]?.decisionId).toBe(decision?.id);
  });

  it("regression: anchors a decision to the step named by afterStepActivityHint, not just the last step in the model", () => {
    const model = makeEmptyModel();
    const update = emptyUpdate();
    // Three unrelated steps already exist; the decision that arrives now is
    // about the FIRST one, described out of order — the previous behavior
    // (always anchoring to `steps[steps.length - 1]`) would have wrongly
    // attached this to "Colocar na prateleira".
    update.addSteps.push(
      { activity: "Verificar preço no site do fornecedor" },
      { activity: "Fazer o pedido" },
      { activity: "Colocar na prateleira" },
    );
    update.addDecisions.push({
      condition: "Preço está dentro da faixa esperada?",
      responsible: null,
      afterStepActivityHint: "Verificar preço no site do fornecedor",
      paths: [
        { label: "Sim", description: null, nextStepActivityHint: null },
        { label: "Não", description: null, nextStepActivityHint: null },
      ],
    });

    const merged = mergeExtractionUpdate(model, update);
    const verificarStep = merged.steps.find((s) => s.activity.startsWith("Verificar preço"));

    expect(merged.decisions[0]?.afterStepId).toBe(verificarStep?.id);
    expect(merged.decisions[0]?.afterStepId).not.toBe(merged.steps[2]?.id);
  });

  it("falls back to the last step when afterStepActivityHint is absent or does not resolve", () => {
    const model = makeEmptyModel();
    const update = emptyUpdate();
    update.addSteps.push({ activity: "Verificar preço" }, { activity: "Fazer o pedido" });

    update.addDecisions.push({
      condition: "Sem hint algum",
      responsible: null,
      paths: [{ label: "Sim", description: null, nextStepActivityHint: null }],
    });
    update.addDecisions.push({
      condition: "Hint que não bate com nada",
      responsible: null,
      afterStepActivityHint: "Etapa que não existe em lugar nenhum",
      paths: [{ label: "Sim", description: null, nextStepActivityHint: null }],
    });

    const merged = mergeExtractionUpdate(model, update);
    const lastStepId = merged.steps[1]?.id;

    expect(merged.decisions[0]?.afterStepId).toBe(lastStepId);
    expect(merged.decisions[1]?.afterStepId).toBe(lastStepId);
  });

  it("leaves an unresolved decision path link as null rather than guessing a target (spec §18)", () => {
    const model = makeEmptyModel();
    const update = emptyUpdate();
    update.addSteps.push({ activity: "Verificar preço" });
    update.addDecisions.push({
      condition: "Preço ok?",
      responsible: null,
      paths: [{ label: "Não", description: null, nextStepActivityHint: "Etapa que ainda não existe" }],
    });

    const merged = mergeExtractionUpdate(model, update);
    expect(merged.decisions[0]?.paths[0]?.nextStepId).toBeNull();
  });

  it("classifies problems exactly as fact/hypothesis from the update, never upgrading confidence", () => {
    const model = makeEmptyModel();
    const update = emptyUpdate();
    update.addProblems.push({
      description: "Não existe sistema formal de controle de estoque",
      relatedStepActivityHint: null,
      type: "lack_of_standardization",
      evidence: "o usuário disse que controla tudo de cabeça",
      impact: null,
      frequency: null,
      confidence: "fact",
    });
    update.addProblems.push({
      description: "Isso pode gerar dependência da verificação visual",
      relatedStepActivityHint: null,
      type: "risk",
      evidence: "inferido a partir do relato acima",
      impact: null,
      frequency: null,
      confidence: "hypothesis",
    });

    const merged = mergeExtractionUpdate(model, update);
    expect(merged.problems.find((p) => p.description.includes("controle de estoque"))?.confidence).toBe("fact");
    expect(merged.problems.find((p) => p.description.includes("dependência"))?.confidence).toBe("hypothesis");
  });
});
