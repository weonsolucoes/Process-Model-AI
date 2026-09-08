import { describe, expect, it } from "vitest";
import { checkEssentialCompleteness } from "@/lib/interview/completeness";
import { makeEmptyModel } from "../support/factories";

describe("checkEssentialCompleteness (spec §10, §12, §32)", () => {
  it("is incomplete for a freshly created process", () => {
    const { complete, missing } = checkEssentialCompleteness(makeEmptyModel());
    expect(complete).toBe(false);
    expect(missing).toContain("gatilho/início");
    expect(missing).toContain("fluxo principal");
    expect(missing).toContain("encerramento/fim");
  });

  it("is complete for a simple linear process (spec §43 Caso 1)", () => {
    const model = makeEmptyModel();
    model.trigger = "Estoque baixo";
    model.endEvent = "Pedido recebido";
    model.steps = [
      {
        id: "s1",
        activity: "Verificar preço",
        responsible: null,
        input: null,
        output: null,
        systemTool: null,
        order: 0,
        nextStepId: null,
        decisionId: null,
      },
    ];
    const { complete } = checkEssentialCompleteness(model);
    expect(complete).toBe(true);
  });

  it("does not require a responsible when there is only one step (no unnecessary question)", () => {
    const model = makeEmptyModel();
    model.trigger = "Estoque baixo";
    model.endEvent = "Pedido recebido";
    model.steps = [
      { id: "s1", activity: "Fazer pedido", responsible: null, input: null, output: null, systemTool: null, order: 0, nextStepId: null, decisionId: null },
    ];
    expect(checkEssentialCompleteness(model).missing).not.toContain("responsáveis");
  });

  it("requires at least one responsible once there is more than one step", () => {
    const model = makeEmptyModel();
    model.trigger = "Estoque baixo";
    model.endEvent = "Pedido recebido";
    model.steps = [
      { id: "s1", activity: "Verificar preço", responsible: null, input: null, output: null, systemTool: null, order: 0, nextStepId: "s2", decisionId: null },
      { id: "s2", activity: "Fazer pedido", responsible: null, input: null, output: null, systemTool: null, order: 1, nextStepId: null, decisionId: null },
    ];
    expect(checkEssentialCompleteness(model).missing).toContain("responsáveis");
  });

  it("flags a decision with fewer than two paths as incomplete (spec §43 Caso 2)", () => {
    const model = makeEmptyModel();
    model.trigger = "Estoque baixo";
    model.endEvent = "Pedido recebido";
    model.steps = [
      { id: "s1", activity: "Verificar preço", responsible: "Ana", input: null, output: null, systemTool: null, order: 0, nextStepId: null, decisionId: "d1" },
    ];
    model.decisions = [{ id: "d1", afterStepId: "s1", condition: "Preço ok?", responsible: null, paths: [{ label: "Sim", description: null, nextStepId: null }] }];
    expect(checkEssentialCompleteness(model).complete).toBe(false);

    model.decisions[0]!.paths.push({ label: "Não", description: null, nextStepId: null });
    expect(checkEssentialCompleteness(model).complete).toBe(true);
  });

  it("orders missing[0] as responsáveis before encerramento/fim, matching spec §10's own priority", () => {
    const model = makeEmptyModel();
    model.trigger = "Estoque baixo";
    // endEvent still null AND responsible still missing — before the fix,
    // `missing[0]` was "encerramento/fim" here (checked before responsible
    // in code, even though §10 lists responsáveis first), which caused a
    // reply about responsibility to be recorded as if it were the end
    // event (see the purchasing-process audit simulation).
    model.steps = [
      { id: "s1", activity: "Verificar preço", responsible: null, input: null, output: null, systemTool: null, order: 0, nextStepId: "s2", decisionId: null },
      { id: "s2", activity: "Fazer pedido", responsible: null, input: null, output: null, systemTool: null, order: 1, nextStepId: null, decisionId: null },
    ];
    const { missing } = checkEssentialCompleteness(model);
    expect(missing).toEqual(["responsáveis", "encerramento/fim"]);
  });

  it("orders an incomplete decision's caminhos before encerramento/fim", () => {
    const model = makeEmptyModel();
    model.trigger = "Estoque baixo";
    model.steps = [
      { id: "s1", activity: "Verificar preço", responsible: "Ana", input: null, output: null, systemTool: null, order: 0, nextStepId: null, decisionId: "d1" },
    ];
    model.decisions = [{ id: "d1", afterStepId: "s1", condition: "Preço ok?", responsible: null, paths: [{ label: "Sim", description: null, nextStepId: null }] }];
    const { missing } = checkEssentialCompleteness(model);
    expect(missing).toEqual([`caminhos da decisão "Preço ok?"`, "encerramento/fim"]);
  });

  it("does not require exhaustive detail — a process with exceptions but a clear main flow is still complete (spec §12)", () => {
    const model = makeEmptyModel();
    model.trigger = "Estoque baixo";
    model.endEvent = "Pedido recebido";
    model.steps = [
      { id: "s1", activity: "Verificar preço", responsible: "Ana", input: null, output: null, systemTool: null, order: 0, nextStepId: null, decisionId: null },
    ];
    model.exceptions = [
      { id: "e1", description: "Fornecedor sem estoque", condition: null, treatment: null, responsible: null, relatedStepId: "s1", returnsToStepId: null },
    ];
    expect(checkEssentialCompleteness(model).complete).toBe(true);
  });
});
