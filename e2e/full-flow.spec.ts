import { test, expect } from "@playwright/test";

/**
 * Spec §48 — the mandatory end-to-end test: create user → create process →
 * start interview → answer questions → Process Model structured →
 * validate → audit → generate outputs → view/export. Runs against the
 * HeuristicProvider (AI_PROVIDER=mock, see playwright.config.ts) so it is
 * fully deterministic and free — no real model call is involved. It
 * exercises the real Next.js server, real SQLite database, and real
 * browser UI end-to-end, with no manual developer intervention.
 */
test("full journey: mapear meu processo, do cadastro à exportação", async ({ page }) => {
  const email = `e2e-${Date.now()}@example.com`;

  await page.goto("/register");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Senha").fill("password123");
  await page.getByRole("button", { name: "Criar conta" }).click();

  await expect(page).toHaveURL(/\/processes\/new/);

  await page.getByLabel("Nome do processo *").fill("Compra de insumos");
  await page.getByLabel("Área / departamento").fill("Compras");
  await page.getByRole("button", { name: "Iniciar entrevista" }).click();

  await expect(page).toHaveURL(/\/processes\/.+\/interview/);
  await expect(page.locator(".chat-bubble.assistant").first()).toBeVisible();

  async function sendMessage(text: string) {
    const textarea = page.getByPlaceholder("Responda aqui...");
    await textarea.fill(text);
    await page.getByRole("button", { name: "Enviar" }).click();
  }

  await sendMessage(
    "Quando o estoque de um produto fica baixo, o comprador verifica o preço e faz o pedido.",
  );
  await expect(page.locator(".chat-bubble.user")).toHaveCount(1);

  await sendMessage("Verificar o preço no site do fornecedor. Fazer o pedido de compra.");
  await sendMessage("O comprador é o responsável por essas etapas.");
  await sendMessage("O processo termina quando o pedido é recebido pelo estoque.");

  await expect(page.getByText("Ir para validação")).toBeVisible({ timeout: 10_000 });
  await page.getByText("Ir para validação").click();

  await expect(page).toHaveURL(/\/processes\/.+\/validate/);
  await expect(page.getByRole("heading", { name: "Vamos revisar o entendimento" })).toBeVisible();

  await page.getByRole("button", { name: "Confirmar e auditar" }).click();

  await expect(page).toHaveURL(/\/processes\/.+\/result/, { timeout: 10_000 });
  await expect(page.getByRole("button", { name: "Gerar entregáveis" })).toBeVisible();
  await page.getByRole("button", { name: "Gerar entregáveis" }).click();

  await expect(page.getByRole("heading", { name: "Fluxograma" })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("heading", { name: "AS IS" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Diagnóstico" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Quick Wins" })).toBeVisible();

  // The flowchart must have actually rendered as an SVG, not an error message.
  await expect(page.locator("svg").first()).toBeVisible({ timeout: 10_000 });

  const asIsFrame = page.frameLocator('iframe[title="AS IS"]');
  await expect(asIsFrame.getByRole("heading", { name: /AS IS/ })).toBeVisible();

  await expect(page.getByRole("link", { name: "PDF" }).first()).toHaveAttribute(
    "href",
    /\/export\/as-is\?format=pdf/,
  );
});
