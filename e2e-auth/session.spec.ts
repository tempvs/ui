import { expect, test } from "@playwright/test";

test("real dev login, session persistence, expiry and logout update the navbar", async ({ page, context }) => {
  await page.goto("/");
  await page.getByLabel("Email", { exact: true }).fill(process.env.E2E_EMAIL!);
  await page.getByLabel("Password", { exact: true }).fill(process.env.E2E_PASSWORD!);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  const account = page.getByRole("button", { name: "Account menu", exact: true });
  await expect(account).toBeVisible();
  expect((await context.request.get("/api/user/me")).status()).toBe(200);
  const cookies = await context.cookies();
  const session = cookies.find((cookie) => cookie.name === "__Host-tempvs-session");
  expect(Boolean(session?.httpOnly && session.secure)).toBe(true);
  await page.reload();
  await expect(account).toBeVisible();
  await page.goto("/map");
  await expect(account).toBeVisible();

  // Invalidate the real session without replacing any API responses. The next
  // identity read must immediately clear the avatar from the existing page.
  await context.clearCookies({ name: "__Host-tempvs-session" });
  expect((await context.request.get("/api/user/me")).status()).toBe(401);
  await page.evaluate(() => {
    window.dispatchEvent(new Event("focus"));
  });
  await expect(account).toHaveCount(0);

  await page.goto("/");
  await page.getByLabel("Email", { exact: true }).fill(process.env.E2E_EMAIL!);
  await page.getByLabel("Password", { exact: true }).fill(process.env.E2E_PASSWORD!);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(account).toBeVisible();
  await account.click();
  await page.getByRole("button", { name: "Log out", exact: true }).click();
  await expect(account).toHaveCount(0);
  expect((await context.request.get("/api/user/me")).status()).toBe(401);
});
