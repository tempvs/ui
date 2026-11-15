import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL || "http://localhost:3000";
const preview = process.env.E2E_PREVIEW === "true";

export default defineConfig({
  testDir: "./e2e",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: { baseURL, trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chrome", use: { ...devices["Pixel 5"] } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `${process.platform === "win32" ? "npm.cmd" : "npm"} ${preview ? "run preview" : "start"}`,
        url: baseURL,
        reuseExistingServer: false,
        timeout: 120_000,
      },
});
