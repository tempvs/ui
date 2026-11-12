import { expect, test } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import webpack from 'webpack';

let bundle: string;
test.beforeAll(async () => {
  const outputPath = path.resolve('node_modules/.cache/account-menu-e2e', String(process.pid));
  await new Promise<void>((resolve, reject) => webpack({
    mode: 'development', entry: path.resolve('e2e/fixtures/header-account-menu.tsx'),
    output: { path: outputPath, filename: 'fixture.js' },
    resolve: { extensions: ['.tsx', '.ts', '.js', '.mjs'] },
    module: { rules: [
      { test: /\.tsx?$/, exclude: /node_modules/, use: { loader: 'babel-loader', options: { presets: [
        ['@babel/preset-env', { targets: { chrome: '120' } }], ['@babel/preset-react', { runtime: 'automatic' }], '@babel/preset-typescript',
      ] } } },
      { test: /\.css$/, use: ['style-loader', 'css-loader'] },
      { test: /\.(png|svg)$/, type: 'asset/inline' },
    ] },
  }, (error, stats) => error || stats?.hasErrors()
    ? reject(error || new Error(stats?.toString({ all: false, errors: true }))) : resolve()));
  bundle = fs.readFileSync(path.join(outputPath, 'fixture.js'), 'utf8');
});

for (const identity of ['anonymous', 'google', 'password', 'initials']) {
  test(`${identity} navigation and account menu`, async ({ page }, testInfo) => {
    if (identity === 'initials' && testInfo.project.name === 'mobile-chrome')
      await page.setViewportSize({ width: 320, height: 700 });
    await page.addInitScript(() => sessionStorage.setItem('tempvs:coachmark:open-current-profile:member', 'dismissed'));
    await page.route('**/account-menu-fixture', route => route.fulfill({ contentType: 'text/html', body: '<meta name="viewport" content="width=device-width, initial-scale=1"><div id="root"></div><script src="/account-menu-fixture.js"></script>' }));
    await page.route('**/account-menu-fixture.js', route => route.fulfill({ contentType: 'text/javascript', body: bundle }));
    await page.route('**/avatar.svg', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#637e70"/><circle cx="32" cy="24" r="12" fill="#f6e4c4"/><ellipse cx="32" cy="62" rx="25" ry="22" fill="#f6e4c4"/></svg>' }));
    await page.route('**/api/**', async route => {
      const url = new URL(route.request().url());
      let body: unknown = { content: [] };
      if (url.pathname === '/api/user/me') body = identity === 'anonymous' ? {} : {
        userId: 'member', email: 'member@example.test',
        ...(identity === 'google' ? { name: 'Ada Lovelace', picture: '/avatar.svg' } : {}),
      };
      else if (url.pathname === '/api/profile/user-profile') body = { id: 'personal', type: 'USER', firstName: 'Grace', lastName: 'Hopper' };
      else if (url.pathname === '/api/profile/club-profile') body = [];
      else if (url.pathname === '/api/images/profile/personal' && identity === 'password') body = { content: [{ id: 'photo', thumbnailUrl: '/avatar.svg' }] };
      await route.fulfill({ json: body });
    });
    await page.goto('/account-menu-fixture');
    const toggle = page.getByRole('button', { name: 'Account menu' });
    if (identity === 'anonymous') {
      await expect(page.getByRole('button', { name: 'Log in', exact: true })).toBeVisible();
      await expect(toggle).toHaveCount(0);
      return;
    }
    await expect(toggle).toBeVisible();
    if (identity === 'initials') await expect(toggle).toHaveText('GH');
    else {
      await expect(toggle.locator('img')).toHaveAttribute('src', '/avatar.svg');
      await expect.poll(() => toggle.locator('img').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
    }
    const geometry = await toggle.locator('.auth-avatar-badge').evaluate(badge => ({
      radius: getComputedStyle(badge).borderRadius,
      width: badge.getBoundingClientRect().width,
      height: badge.getBoundingClientRect().height,
    }));
    expect(geometry.radius).toBe('50%');
    expect(geometry.width).toBe(geometry.height);
    await expect(page.getByRole('button', { name: 'Log out', exact: true })).toHaveCount(0);
    await toggle.click();
    const menu = page.locator('.auth-account-dropdown');
    await expect(menu).toBeVisible();
    await expect(menu).toContainText(identity === 'google' ? 'Ada Lovelace' : 'Grace Hopper');
    await expect(menu).toHaveAttribute('data-popper-placement', 'bottom-end');
    const bounds = await menu.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`${identity}-menu.png`) });
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await toggle.click();
    await page.mouse.click(5, 300);
    await expect(menu).toBeHidden();
    await toggle.click();
    let logoutMethod = '';
    await page.route('**/auth/logout', route => {
      logoutMethod = route.request().method();
      return route.fulfill({ contentType: 'text/html', body: 'Logged out' });
    });
    await page.getByRole('button', { name: 'Log out', exact: true }).click();
    await expect(page).toHaveURL(/\/auth\/logout$/);
    expect(logoutMethod).toBe('POST');
  });
}
