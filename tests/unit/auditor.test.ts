import { describe, expect, it } from "vitest";
import { runAudit } from "@/lib/auditor/auditor";
import { FixtureProvider, audit } from "../support/fixtureProvider";
import { makeEmptyModel } from "../support/factories";

function completeLinearModel() {
  const model = makeEmptyModel();
  model.trigger = "Estoque baixo";
  model.endEvent = "Pedido recebido";
  model.steps = [
    { id: "s1", activity: "Verificar preço, alguém aprova depois", responsible: "Ana", input: null, output: null, systemTool: null, order: 0, nextStepId: null, decisionId: null },
  ];
  return model;
}

describe("AI Auditor (spec §31-32, §46)", () => {
  it("never approves when the deterministic essential floor fails, even if the AI says approved", async () => {
    const model = makeEmptyModel(); // nothing filled in
    const provider = new FixtureProvider([], [audit({ approved: true, missingCritical: [] })]);

    const { result } = await runAudit(model, provider);
    expect(result.approved).toBe(false);
    expect(result.missingCritical.length).toBeGreaterThan(0);
  });

  it("does not block a sufficiently-understood process just because of secondary gaps (spec §32)", async () => {
    const model = completeLinearModel();
    const provider = new FixtureProvider(
      [],
      [audit({ approved: true, secondaryGaps: ["não sabemos quem criou a planilha"] })],
    );

    const { result } = await runAudit(model, provider);
    expect(result.approved).toBe(true);
  });

  it("detects ambiguous phrasing deterministically in addition to whatever the AI flags (spec §31 'Ambiguidade')", async () => {
    const model = completeLinearModel();
    const provider = new FixtureProvider([], [audit({ approved: true, ambiguities: [] })]);

    const { result } = await runAudit(model, provider);
    expect(result.ambiguities.some((a) => a.quote.includes("alguém aprova"))).toBe(true);
  });

  it("merges missing-critical findings from both the AI and the deterministic check without duplicates", async () => {
    const model = makeEmptyModel();
    model.trigger = "Estoque baixo"; // deterministic check will still flag fluxo principal + encerramento
    const provider = new FixtureProvider(
      [],
      [audit({ approved: false, missingCritical: ["encerramento/fim"] })],
    );

    const { result } = await runAudit(model, provider);
    expect(result.missingCritical).toContain("fluxo principal");
    expect(result.missingCritical).toContain("encerramento/fim");
    expect(result.missingCritical.filter((m) => m === "encerramento/fim")).toHaveLength(1);
  });

  it("flags incomplete decisions and undefined responsibilities as reported by the AI", async () => {
    const model = completeLinearModel();
    const provider = new FixtureProvider(
      [],
      [
        audit({
          approved: true,
          undefinedResponsibilities: ["Consultar gerente"],
          incompleteDecisions: ["Preço ok?"],
        }),
      ],
    );

    const { result } = await runAudit(model, provider);
    expect(result.undefinedResponsibilities).toContain("Consultar gerente");
    expect(result.incompleteDecisions).toContain("Preço ok?");
  });
});
