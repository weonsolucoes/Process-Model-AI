import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";

const PORT = 3100;

// Some environments pre-install a Chromium revision that doesn't match the
// exact build this @playwright/test version expects and would otherwise try
// to download. Fall back to it explicitly only when present; a normal CI/dev
// machine with `npx playwright install` run keeps the default resolution.
const conventionalChromium = "/opt/pw-browsers/chromium";
const executablePath = existsSync(conventionalChromium) ? conventionalChromium : undefined;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    ...(executablePath ? { launchOptions: { executablePath } } : {}),
  },
  webServer: {
    command: "npm run dev -- -p " + PORT,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      DATABASE_URL: "file:./e2e-test.db",
      AUTH_SECRET: "e2e-test-secret-do-not-use-in-prod",
      AI_PROVIDER: "mock",
    },
  },
});
