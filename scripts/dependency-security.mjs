import assert from "node:assert/strict";
import { readFileSync, writeFileSync, existsSync, realpathSync, rmSync, symlinkSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, "..");
const apply = process.argv.includes("--apply");
const manifest = (file) => JSON.parse(readFileSync(file, "utf8"));

if (existsSync(path.join(root, "node_modules/aws-cdk-lib/package.json"))) {
  const cdk = path.join(root, "node_modules/aws-cdk-lib");
  assert.equal(manifest(path.join(cdk, "package.json")).version, "2.277.0", "Review/remove the CDK mitigation when updating CDK");
  const patched = path.join(root, "node_modules/minimatch");
  assert.equal(manifest(path.join(patched, "package.json")).version, "11.0.8");
  const vendored = path.join(cdk, "node_modules/minimatch");
  if (apply && realpathSync(vendored) !== realpathSync(patched)) {
    assert.equal(manifest(path.join(vendored, "package.json")).version, "10.2.6", "Unexpected vendored minimatch; review mitigation");
    // This exact, guarded dependency directory is recreated by npm ci. Never follow a link when deleting it.
    assert.equal(vendored, path.join(root, "node_modules/aws-cdk-lib/node_modules/minimatch"));
    rmSync(vendored, { recursive: true, force: true });
    symlinkSync(patched, vendored, process.platform === "win32" ? "junction" : "dir");
  }
  const cdkRequire = createRequire(path.join(cdk, "package.json"));
  assert.equal(realpathSync(cdkRequire.resolve("minimatch")), realpathSync(require.resolve("minimatch")), "CDK must resolve patched minimatch");
  const { minimatch } = cdkRequire("minimatch");
  assert.equal(minimatch("lib/nested/example.ts", "lib/**/*.ts"), true);
  assert.equal(minimatch("lib/example.js", "lib/**/*.ts"), false);
  console.log("CDK resolves minimatch 11.0.8 (GHSA-g3hv-75wg-m249 mitigation)");
}

if (existsSync(path.join(root, "node_modules/deepmerge/package.json"))) {
  const directory = path.join(root, "node_modules/deepmerge");
  assert.equal(manifest(path.join(directory, "package.json")).version, "4.3.1", "Review/remove deepmerge mitigation when upgrading");
  // Define own data properties instead of invoking Object.prototype.__proto__'s setter.
  // Preserve string/symbol keys, custom merge, array merging and normal object prototypes.
  for (const file of ["index.js", "dist/cjs.js", "dist/umd.js"]) {
    const target = path.join(directory, file);
    const original = readFileSync(target, "utf8");
    const matches = [...original.matchAll(/destination\[key\] = ([^;\r\n]+);?/g)];
    if (apply && matches.length) {
      assert.equal(matches.length, 3, `Unexpected deepmerge source: ${file}`);
      writeFileSync(target, original.replace(/destination\[key\] = ([^;\r\n]+);?/g,
        "Object.defineProperty(destination, key, { value: $1, enumerable: true, configurable: true, writable: true });"));
    }
    assert.ok(!readFileSync(target, "utf8").includes("destination[key] ="), `Unpatched deepmerge: ${file}`);
  }
  const merge = require("deepmerge");
  const poisoned = JSON.parse('{"__proto__":{"polluted":true},"safe":{"a":1}}');
  for (const [target, source] of [[poisoned, {}], [Object.create(null), poisoned], [{}, poisoned]]) {
    const result = merge(target, source);
    assert.equal(Object.getPrototypeOf(result), Object.prototype);
    assert.equal(result.polluted, undefined);
    assert.equal({}.polluted, undefined);
  }
  assert.deepEqual(merge({ nested: { a: 1 }, list: [1] }, { nested: { b: 2 }, list: [2] }),
    { nested: { a: 1, b: 2 }, list: [1, 2] });
  const symbol = Symbol("retained");
  assert.equal(merge({}, { [symbol]: 42 })[symbol], 42);
  assert.deepEqual(merge.all([{ a: 1 }, { b: 2 }]), { a: 1, b: 2 });
  console.log("deepmerge prototype-poisoning regression passed (GHSA-gcqx-w48m-w2h4 mitigation)");
}

if (existsSync(path.join(root, "node_modules/@typescript/native/package.json"))) {
  assert.equal(manifest(path.join(root, "node_modules/@typescript/native/package.json")).version, "7.0.2");
  const api = require("typescript");
  assert.equal(manifest(path.join(root, "node_modules/typescript/package.json")).version, "6.0.2");
  assert.match(api.version, /^6\.0\./);
  assert.equal(typeof api.createProgram, "function", "ESLint requires the compatibility compiler API");
  console.log("TypeScript 7.0.2 native compiler / 6.0.2 ESLint API bridge verified");
}
