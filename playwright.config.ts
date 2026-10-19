import { defineConfig, devices } from "@playwright/test";

const PORT = 3200;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } } },
    { name: "mobile", use: { ...devices["Pixel 7"], launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } } },
  ],
  // Mode démo : aucune donnée réelle, aucun appel externe.
  webServer: {
    command: `npm run build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    timeout: 300_000,
    reuseExistingServer: !process.env.CI,
    env: { BEESOCIAL_DEMO_MODE: "1", NEXT_TELEMETRY_DISABLED: "1" },
  },
});
