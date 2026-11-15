import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, "..");
const apply = process.argv.includes("--apply");
const manifest = (file) => JSON.parse(readFileSync(file, "utf8"));

if (existsSync(path.join(root, "node_modules/aws-cdk-lib/package.json"))) {
  const cdk = path.join(root, "node_modules/aws-cdk-lib");
  assert.equal(manifest(path.join(cdk, "package.json")).version, "2.277.0", "Review/remove CDK mitigation on upgrade");
  const vendored = path.join(cdk, "node_modules/minimatch");
  assert.equal(manifest(path.join(vendored, "package.json")).version, "10.2.6");
  // Backport https://github.com/isaacs/minimatch/commit/77a0f5c4b80bdc641c3c930a1d9edf5ad2db57f8
  // Keep package/lock metadata intact. Verify exact original and patched source.
  const fingerprints = {
  "dist/commonjs/index.js": [
    "d224f71f20d7c206fcc5b7e9f747324c7698345a0b2c28d717dd9cf698306783",
    "df62b5058f6b4077d524f0717bad0b8ea525865783535aaa029bc7e113f85ca0"
  ],
  "dist/esm/index.js": [
    "59821ec2ce0d3df968292036e5c831ad322b33e9c33a949ecbc9dfe125d165be",
    "b5665e0682c95482f9f0f2fcb3c0e094f3a5118bc09bfcc230004472cc485218"
  ]
};
  const replacements = [
  [
    "firstPhasePreProcess(globParts) {",
    "firstPhasePreProcess(globParts) {\n        const { braceExpandMax = 100_000 } = this.options;"
  ],
  [
    "p2 === '..') {",
    "p2 === '..' || globParts.length >= braceExpandMax) {"
  ],
  [
    "secondPhasePreProcess(globParts) {",
    "secondPhasePreProcess(globParts) {\n        if (globParts.length > 1000) return globParts;"
  ]
];
  for (const [entry, [originalHash, patchedHash]] of Object.entries(fingerprints)) {
    const file = path.join(vendored, entry);
    let source = readFileSync(file, "utf8");
    const hash = value => createHash("sha256").update(value).digest("hex");
    if (apply && hash(source) === originalHash) {
      for (const [before, after] of replacements) {
        assert.equal(source.split(before).length - 1, 1, "Unexpected minimatch source");
        source = source.replace(before, after);
      }
      writeFileSync(file, source);
    }
    assert.equal(hash(source), patchedHash, "Missing or unexpected minimatch security patch");
  }
  const cdkRequire = createRequire(path.join(cdk, "package.json"));
  const { minimatch, Minimatch } = cdkRequire("minimatch");
  assert.equal(minimatch("lib/nested/example.ts", "lib/**/*.ts"), true);
  assert.equal(minimatch("lib/example.js", "lib/**/*.ts"), false);
  const bounded = new Minimatch("a/" + "**/../a/b/".repeat(8) + "c", { optimizationLevel: 2, braceExpandMax: 32 });
  assert.ok(bounded.globParts.length > 1 && bounded.globParts.length <= 32, "Globparts amplification must be bounded");
  const large = Array.from({ length: 1001 }, (_, index) => [String(index)]);
  bounded.partsMatch = () => { throw new Error("Quadratic comparison must not run for large sets"); };
  assert.equal(bounded.secondPhasePreProcess(large), large);
  console.log("CDK minimatch upstream amplification/complexity regressions passed (GHSA-g3hv-75wg-m249)");
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
