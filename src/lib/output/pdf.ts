import { existsSync } from "node:fs";
import { chromium } from "playwright-core";

/**
 * Renders a self-contained HTML report to PDF using the pre-installed
 * Chromium (spec §41: "PDF/documento pode ser utilizado inicialmente").
 * This never navigates to the live app — it prints static, already-escaped
 * HTML strings the Output Engine produced, so there is no auth/session
 * concern and no dependency on the app server being reachable.
 */
export async function renderHtmlToPdf(html: string): Promise<Buffer> {
  const executablePath = resolveChromiumPath();
  const browser = await chromium.launch(executablePath ? { executablePath } : undefined);
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    const pdf = await page.pdf({ format: "A4", margin: { top: "16mm", bottom: "16mm", left: "14mm", right: "14mm" } });
    return pdf;
  } finally {
    await browser.close();
  }
}

function resolveChromiumPath(): string | undefined {
  const fromEnv = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
  if (fromEnv && existsSync(fromEnv)) return fromEnv;
  const conventional = "/opt/pw-browsers/chromium";
  if (existsSync(conventional)) return conventional;
  return undefined;
}
