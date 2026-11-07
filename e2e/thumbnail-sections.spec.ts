import { expect, test } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import webpack from 'webpack';

let bundle: string;
test.beforeAll(async () => {
  const outputPath = path.resolve('node_modules/.cache/thumbnail-e2e', String(process.pid));
  await new Promise<void>((resolve, reject) => webpack({
    mode: 'development', entry: path.resolve('e2e/fixtures/thumbnail-sections.tsx'),
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

test('public thumbnail sections share three-row geometry and prefetch before the scroll ends', async ({ page }, testInfo) => {
  await page.route('**/thumbnail-fixture', route => route.fulfill({ contentType: 'text/html', body: '<meta name="viewport" content="width=device-width, initial-scale=1"><div id="root"></div><script src="/thumbnail-fixture.js"></script>' }));
  await page.route('**/thumbnail-fixture.js', route => route.fulfill({ contentType: 'text/javascript', body: bundle }));
  await page.route('**/thumb.svg', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44"><rect width="44" height="44" rx="5" fill="#d3bea0"/></svg>' }));
  const eventPages: string[] = [];
  const itemPages: string[] = [];
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    let body: unknown = { content: [] };
    if (url.pathname.endsWith('/clubs')) body = Array.from({ length: 30 }, (_, index) => ({
      id: `club-${index}`, name: `Club ${index}`, creatorUserId: 'owner', adminUserIds: [], period: 'HIGH_MIDDLE_AGES', canManage: false, canManageAdmins: false,
    }));
    else if (/followed-events|participating-events/.test(url.pathname)) {
      const offset = url.searchParams.has('nextToken') ? 9 : 0;
      eventPages.push(url.href);
      body = { content: Array.from({ length: 9 }, (_, index) => ({ id: `event-${offset + index}`, name: `Event ${offset + index}` })), ...(offset ? {} : { nextToken: 'events-2' }) };
    } else if (url.pathname.includes('/stash/group/profile/')) body = { groups: [{ id: 'gear', name: 'Gear' }] };
    else if (url.pathname.includes('/stash/group/gear/item')) {
      const offset = url.searchParams.has('nextToken') ? 9 : 0;
      itemPages.push(url.href);
      body = { content: Array.from({ length: 9 }, (_, index) => ({ id: `item-${offset + index}`, name: `Item ${offset + index}`, itemGroup: { id: 'gear' } })), ...(offset ? {} : { nextToken: 'items-2' }) };
    } else if (url.pathname.includes('/images/albums/')) body = { content: Array.from({ length: 30 }, (_, index) => ({ id: `album-${index}`, name: `Album ${index}`, description: 'Campaign photos' })) };
    else if (url.pathname.includes('/images/')) body = { content: [{ thumbnailUrl: '/thumb.svg' }] };
    await route.fulfill({ json: body });
  });
  await page.goto('/thumbnail-fixture');

  for (const id of ['profiles', 'clubs', 'followed-events', 'event-memberships', 'items', 'albums']) {
    const section = page.getByTestId(id);
    await expect(section.locator('.thumbnail-list-row')).toHaveCount(9);
    await expect(section.locator('.thumbnail-list-viewport')).toHaveCount(1);
    const geometry = await section.locator('.thumbnail-list-viewport').evaluate(viewport => {
      const row = viewport.querySelector('.thumbnail-list-row')!;
      const image = row.querySelector('img')!.getBoundingClientRect();
      const copy = row.querySelector('.thumbnail-entry-copy')!.getBoundingClientRect();
      return { height: viewport.clientHeight, row: row.getBoundingClientRect().height, scrolls: viewport.scrollHeight > viewport.clientHeight,
        bullets: getComputedStyle(row.parentElement!).listStyleType, imageWidth: image.width, nameAfterImage: copy.left >= image.right };
    });
    expect(geometry.height).toBeCloseTo(geometry.row * 3, 0);
    expect(geometry.scrolls).toBe(true);
    expect(geometry.bullets).toBe('none');
    expect(geometry.imageWidth).toBeCloseTo(geometry.row * 2.75 / 4, 1);
    expect(geometry.nameAfterImage).toBe(true);
  }
  expect(itemPages).toHaveLength(1);
  expect(eventPages).toHaveLength(2);

  for (const id of ['items', 'followed-events', 'event-memberships', 'albums', 'profiles', 'clubs']) {
    const viewport = page.getByTestId(id).locator('.thumbnail-list-viewport');
    await viewport.evaluate(element => { element.scrollTop = 256; element.dispatchEvent(new Event('scroll')); });
    await expect(page.getByTestId(id).locator('.thumbnail-list-row')).toHaveCount(18);
    expect(await viewport.evaluate(element => element.scrollTop)).toBe(256);
  }
  expect(itemPages[1]).toContain('nextToken=items-2');
  expect(eventPages.filter(url => url.includes('nextToken=events-2'))).toHaveLength(2);
  await page.getByTestId('profiles').getByRole('searchbox').fill('Profile 29');
  await expect(page.getByRole('link', { name: 'Profile 29', exact: true })).toBeVisible();
  expect(await page.getByTestId('profiles').locator('.thumbnail-list-viewport').evaluate(element => element.scrollTop)).toBe(0);
  await page.screenshot({ path: testInfo.outputPath('thumbnail-sections.png'), fullPage: true });
});
