import { describe, expect, it } from "vitest";
import { resolveNextContradiction, stripContradictedFields } from "@/lib/interview/contradictions";
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

describe("contradiction handling (spec §17)", () => {
  it("strips only the contradicted top-level field, keeping the rest of the update intact", () => {
    const update = emptyUpdate();
    update.topLevel.trigger = "Pedido do cliente";
    update.topLevel.objective = "Reduzir custo de compras";
    update.addSteps.push({ activity: "Fazer pedido" });

    const stripped = stripContradictedFields(update, [
      { field: "trigger", existingValue: "Estoque baixo", newValue: "Pedido do cliente", explanation: "mudou o gatilho" },
    ]);

    expect(stripped.topLevel.trigger).toBeUndefined();
    expect(stripped.topLevel.objective).toBe("Reduzir custo de compras");
    expect(stripped.addSteps).toHaveLength(1);
  });

  it("is a no-op when there are no contradictions", () => {
    const update = emptyUpdate();
    update.topLevel.trigger = "Estoque baixo";
    expect(stripContradictedFields(update, [])).toBe(update);
  });

  it("resolveNextContradiction applies the newer value when the user picks 'a segunda'", () => {
    const model = makeEmptyModel();
    model.trigger = "Estoque baixo";
    model.pendingContradictions = [
      { field: "trigger", existingValue: "Estoque baixo", newValue: "Pedido do cliente", explanation: "mudou" },
    ];

    const resolved = resolveNextContradiction(model, "a segunda está certa");
    expect(resolved.trigger).toBe("Pedido do cliente");
    expect(resolved.pendingContradictions).toHaveLength(0);
  });

  it("resolveNextContradiction keeps the existing value when the user picks 'a primeira'", () => {
    const model = makeEmptyModel();
    model.trigger = "Estoque baixo";
    model.pendingContradictions = [
      { field: "trigger", existingValue: "Estoque baixo", newValue: "Pedido do cliente", explanation: "mudou" },
    ];

    const resolved = resolveNextContradiction(model, "a primeira, isso mesmo");
    expect(resolved.trigger).toBe("Estoque baixo");
    expect(resolved.pendingContradictions).toHaveLength(0);
  });

  it("resolveNextContradiction falls back to the user's literal words when the answer matches neither option", () => {
    const model = makeEmptyModel();
    model.trigger = "Estoque baixo";
    model.pendingContradictions = [
      { field: "trigger", existingValue: "Estoque baixo", newValue: "Pedido do cliente", explanation: "mudou" },
    ];

    const resolved = resolveNextContradiction(model, "Na verdade é quando o gerente autoriza a compra");
    expect(resolved.trigger).toBe("Na verdade é quando o gerente autoriza a compra");
  });

  it("resolves one contradiction at a time, leaving the rest pending", () => {
    const model = makeEmptyModel();
    model.pendingContradictions = [
      { field: "trigger", existingValue: "A", newValue: "B", explanation: "x" },
      { field: "endEvent", existingValue: "C", newValue: "D", explanation: "y" },
    ];
    const resolved = resolveNextContradiction(model, "a segunda");
    expect(resolved.trigger).toBe("B");
    expect(resolved.pendingContradictions).toHaveLength(1);
    expect(resolved.pendingContradictions[0]?.field).toBe("endEvent");
  });
});
