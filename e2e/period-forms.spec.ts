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

test('public period forms immediately display a plain name after native selection', async ({ page }) => {
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
  await inline.locator('.inline-editable-control').click();
  const inlineSelect = inline.getByRole('combobox');
  await inlineSelect.selectOption('WWI');
  await expect(inline.locator('.option-label-select-value')).toHaveText('World War I');
  await expect(inlineSelect).toHaveCSS('color', 'rgba(0, 0, 0, 0)');
  await expect(inlineSelect.locator('option:checked')).toHaveText('World War I (1914–1918)');
  await page.getByRole('button', { name: 'Outside' }).click();
  await expect(inline.locator('.option-label-select-value')).toHaveText('World War I');
});
