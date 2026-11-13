import { expect, test } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import webpack from 'webpack';

let bundle: string;
test.beforeAll(async () => {
  const outputPath = path.resolve('node_modules/.cache/period-forms-e2e', String(process.pid));
  await new Promise<void>((resolve, reject) => webpack({
    mode: 'development', entry: path.resolve('e2e/fixtures/period-forms.tsx'),
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

test('public period forms immediately display a plain name after native selection', async ({ page }, testInfo) => {
  await page.route('**/period-form-fixture', route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: '<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><div id="root"></div><script src="/period-form-fixture.js"></script>' }));
  await page.route('**/period-form-fixture.js', route => route.fulfill({ contentType: 'text/javascript; charset=utf-8', body: bundle }));
  await page.goto('/period-form-fixture');
  const create = page.getByTestId('create-period');
  const createSelect = create.getByRole('combobox');
  await createSelect.selectOption('INTERWAR');
  await expect(create.locator('.option-label-select-value')).toHaveText('Interwar');
  await expect(createSelect).toHaveCSS('color', 'rgba(0, 0, 0, 0)');
  await expect(createSelect.locator('option:checked')).toHaveText('Interwar (1918–1939)');
  await createSelect.focus();
  await createSelect.press('ArrowUp');
  await expect(create.locator('.option-label-select-value')).toHaveText('World War I');
  await createSelect.press('ArrowDown');
  await expect(create.locator('.option-label-select-value')).toHaveText('Interwar');
  expect(await create.evaluate(form => new FormData(form as HTMLFormElement).get('period'))).toBe('INTERWAR');

  const inline = page.getByTestId('inline-period');
  const beforeWidth = (await inline.boundingBox())!.width;
  const beforeYears = (await page.getByTestId('adjacent-years').boundingBox())!.x;
  await inline.locator('.inline-editable-control').click();
  expect(Math.abs((await inline.boundingBox())!.width - beforeWidth)).toBeLessThan(1);
  expect(Math.abs((await page.getByTestId('adjacent-years').boundingBox())!.x - beforeYears)).toBeLessThan(1);
  const inlineSelect = inline.getByRole('combobox');
  const selectedImage = await inline.locator('.option-label-select-value').screenshot({ scale: 'css', path: testInfo.outputPath('period-edit-value.png') });
  const visibleTextPixels = await page.evaluate(async data => {
    const image = new Image();
    image.src = `data:image/png;base64,${data}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d')!;
    context.drawImage(image, 0, 0);
    const { data: pixels } = context.getImageData(2, 2, Math.min(110, image.width - 40), image.height - 4);
    let count = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      if (pixels[index] < 180 && pixels[index + 1] < 180 && pixels[index + 2] < 180 && pixels[index + 3] > 128) count++;
    }
    return count;
  }, selectedImage.toString('base64'));
  expect(visibleTextPixels, 'the selected period text must remain visibly painted in edit mode').toBeGreaterThan(40);
  await inlineSelect.selectOption('WWI');
  await expect(inline.locator('.option-label-select-value')).toHaveText('World War I');
  await expect(inlineSelect).toHaveCSS('color', 'rgba(0, 0, 0, 0)');
  await expect(inlineSelect.locator('option:checked')).toHaveText('World War I (1914–1918)');
  await page.getByRole('button', { name: 'Outside' }).click();
  await expect(inline.locator('.option-label-select-value')).toHaveText('World War I');
  const event = page.getByTestId('event-period');
  const beforeEvent = (await event.boundingBox())!;
  const beforeOutside = (await page.getByRole('button', { name: 'Outside' }).boundingBox())!.y;
  await event.getByRole('combobox').click();
  const menu = event.getByRole('listbox');
  await expect(menu).toBeVisible();
  expect((await menu.boundingBox())!.y).toBeGreaterThanOrEqual(beforeEvent.y + beforeEvent.height - 1);
  expect(Math.abs((await event.boundingBox())!.width - beforeEvent.width)).toBeLessThan(1);
  expect(Math.abs((await page.getByRole('button', { name: 'Outside' }).boundingBox())!.y - beforeOutside)).toBeLessThan(1);
  await event.getByRole('combobox').press('Escape');
  await expect(menu).not.toBeVisible();
});
