import { defineConfig, devices } from "@playwright/test";

// Real credentials may only be submitted to the owned dev site. Never record
// traces, screenshots, video or storage state containing an authenticated session.
if (process.env.E2E_BASE_URL !== "https://dev.tempvs.club") {
  throw new Error("Real-authentication tests require E2E_BASE_URL=https://dev.tempvs.club");
}
if (!process.env.E2E_EMAIL || !process.env.E2E_PASSWORD) {
  throw new Error("Configure the dedicated dev E2E_EMAIL and E2E_PASSWORD fixture secrets");
}

export default defineConfig({
  testDir: "./e2e-auth",
  timeout: 90_000,
  expect: { timeout: 20_000 },
  workers: 1,
  reporter: "list",
  use: {
    baseURL: process.env.E2E_BASE_URL,
    trace: "off",
    screenshot: "off",
    video: "off",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
});
