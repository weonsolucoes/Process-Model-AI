import { test, expect, request as playwrightRequest } from "@playwright/test";

/**
 * Spec §49 — technical tests: auth, isolation between users, error
 * handling, and file generation/download. Uses the API directly (no
 * browser) against the same real server the full-flow test drives.
 */

async function registerAndGetContext(baseURL: string, email: string) {
  const ctx = await playwrightRequest.newContext({ baseURL });
  const res = await ctx.post("/api/auth/register", {
    data: { email, password: "password123" },
  });
  expect(res.ok()).toBe(true);
  return ctx;
}

test("duplicate email registration is rejected", async ({ baseURL }) => {
  const email = `dup-${Date.now()}@example.com`;
  const ctx = await registerAndGetContext(baseURL!, email);
  const res = await ctx.post("/api/auth/register", { data: { email, password: "password123" } });
  expect(res.status()).toBe(400);
});

test("unauthenticated requests are rejected", async ({ baseURL }) => {
  const ctx = await playwrightRequest.newContext({ baseURL });
  const res = await ctx.get("/api/processes");
  expect(res.status()).toBe(401);
});

test("a user cannot read, message, or export another user's process (spec §40 isolation)", async ({
  baseURL,
}) => {
  const ownerCtx = await registerAndGetContext(baseURL!, `owner-${Date.now()}@example.com`);
  const createRes = await ownerCtx.post("/api/processes", { data: { name: "Processo privado" } });
  const { process } = await createRes.json();

  const otherCtx = await registerAndGetContext(baseURL!, `other-${Date.now()}@example.com`);

  const getRes = await otherCtx.get(`/api/processes/${process.id}`);
  expect(getRes.status()).toBe(404);

  const msgRes = await otherCtx.post(`/api/processes/${process.id}/messages`, {
    data: { content: "tentando invadir" },
  });
  expect(msgRes.status()).toBe(404);

  const exportRes = await otherCtx.get(`/api/processes/${process.id}/export/as-is?format=html`);
  expect(exportRes.status()).toBe(404);
});

test("status transitions are enforced — cannot audit before validation, cannot generate before audit", async ({
  baseURL,
}) => {
  const ctx = await registerAndGetContext(baseURL!, `flow-${Date.now()}@example.com`);
  const createRes = await ctx.post("/api/processes", { data: { name: "Processo de teste" } });
  const { process } = await createRes.json();

  const confirmTooEarly = await ctx.post(`/api/processes/${process.id}/confirm`);
  expect(confirmTooEarly.status()).toBe(400);

  const generateTooEarly = await ctx.post(`/api/processes/${process.id}/generate`);
  expect(generateTooEarly.status()).toBe(400);
});

test("invalid request bodies are rejected with 400, not a server error", async ({ baseURL }) => {
  const ctx = await registerAndGetContext(baseURL!, `badbody-${Date.now()}@example.com`);
  const createRes = await ctx.post("/api/processes", { data: { name: "Processo" } });
  const { process } = await createRes.json();

  const res = await ctx.post(`/api/processes/${process.id}/messages`, {
    data: { content: "" }, // empty content should fail validation
  });
  expect(res.status()).toBe(400);
});

test("a session survives across requests — resuming an interrupted interview keeps prior messages", async ({
  baseURL,
}) => {
  const email = `resume-${Date.now()}@example.com`;
  const ctx = await registerAndGetContext(baseURL!, email);
  const createRes = await ctx.post("/api/processes", { data: { name: "Processo retomável" } });
  const { process } = await createRes.json();

  await ctx.post(`/api/processes/${process.id}/messages`, {
    data: { content: "Quando chega um pedido, nós começamos a produção." },
  });

  const storageState = await ctx.storageState();
  const resumedCtx = await playwrightRequest.newContext({ baseURL, storageState });

  const detail = await resumedCtx.get(`/api/processes/${process.id}`);
  expect(detail.ok()).toBe(true);
  const body = await detail.json();
  expect(body.messages.length).toBeGreaterThanOrEqual(3); // opening question + user + assistant reply
});

test("AS IS export produces a real PDF file", async ({ baseURL }) => {
  const ctx = await registerAndGetContext(baseURL!, `pdf-${Date.now()}@example.com`);
  const createRes = await ctx.post("/api/processes", { data: { name: "Processo PDF" } });
  const { process } = await createRes.json();

  await ctx.post(`/api/processes/${process.id}/messages`, {
    data: { content: "Quando o pedido chega, produzimos e enviamos ao cliente." },
  });
  await ctx.post(`/api/processes/${process.id}/messages`, {
    data: { content: "Produzir o item. Enviar ao cliente." },
  });
  await ctx.post(`/api/processes/${process.id}/messages`, {
    data: { content: "A produção é responsável por essas etapas." },
  });
  await ctx.post(`/api/processes/${process.id}/messages`, {
    data: { content: "O processo acaba quando o cliente recebe o item." },
  });

  const confirmRes = await ctx.post(`/api/processes/${process.id}/confirm`);
  expect(confirmRes.ok()).toBe(true);
  const generateRes = await ctx.post(`/api/processes/${process.id}/generate`);
  expect(generateRes.ok()).toBe(true);

  const pdfRes = await ctx.get(`/api/processes/${process.id}/export/as-is?format=pdf`);
  expect(pdfRes.ok()).toBe(true);
  expect(pdfRes.headers()["content-type"]).toBe("application/pdf");
  const buffer = await pdfRes.body();
  expect(buffer.subarray(0, 4).toString()).toBe("%PDF");
});
