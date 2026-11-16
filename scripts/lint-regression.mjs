import assert from "node:assert/strict";
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = path.resolve(import.meta.dirname, "..");
const source = realpathSync(path.join(root, "src"));
const fixture = mkdtempSync(path.join(source, "lint-regression-"));
const expectedRules = ["react/rules-of-hooks", "react/exhaustive-deps", "no-debugger"];
const ui = true;
const executable = path.join(root, "node_modules", "oxlint", "bin", "oxlint");

function lint(name, code, valid, expected = []) {
  const file = path.join(fixture, name);
  writeFileSync(file, code);
  const result = spawnSync(process.execPath, [executable, "--format=json", ...(ui ? ["--max-warnings=0"] : []), file], {
    cwd: root, encoding: "utf8", timeout: 120_000,
  });
  assert.ifError(result.error);
  const report = JSON.parse(result.stdout);
  assert.ok(report.number_of_files > 0, `${name} must actually be linted`);
  assert.equal(result.status, valid ? 0 : 1, `${name}: ${result.stdout}\n${result.stderr}`);
  const rules = new Set(report.diagnostics.map((diagnostic) => {
    const match = /^(.*?)\((.*?)\)$/.exec(diagnostic.code ?? "");
    if (!match) return "parser";
    const plugin = match[1].replace("react-hooks", "react").replace("typescript-eslint", "typescript");
    return plugin === "eslint" ? match[2] : `${plugin}/${match[2]}`;
  }));
  for (const rule of expected) assert.ok(rules.has(rule), `${name} must report ${rule}: ${result.stdout}`);
}

try {
  if (ui) {
    lint("valid.tsx", `import { useEffect, useState } from "react";
export function Valid({ value }: { value: number }) {
  const [count] = useState(0);
  useEffect(() => { document.title = String(value); }, [value]);
  return <span>{count}</span>;
}`, true);
    lint("invalid.tsx", `import { useEffect, useState } from "react";
export function Invalid({ value, enabled }: { value: number; enabled: boolean }) {
  if (enabled) useState(0);
  useEffect(() => { document.title = String(value); }, []);
  debugger;
  return <span>{value}</span>;
}`, false, expectedRules);
    lint("warning.tsx", `import { useEffect } from "react";
export function Warning({ value }: { value: number }) {
  useEffect(() => { document.title = String(value); }, []);
  return <span>{value}</span>;
}`, false, ["react/exhaustive-deps"]);
    lint("suppressed.tsx", `import { useEffect } from "react";
export function Suppressed({ value }: { value: number }) {
  useEffect(() => { document.title = String(value); }, []); // oxlint-disable-line react/exhaustive-deps
  return <span>{value}</span>;
}`, true);
  } else {
    writeFileSync(path.join(fixture, "types.ts"), "export interface Input { value: string }\n");
    lint("valid.ts", `import type { Input } from "./types";
declare function read(): Promise<string>;
export async function valid(input: Input): Promise<string> {
  try { return input.value + await read(); } catch { return "fallback"; }
}
void valid({ value: "safe" });
`, true);
    lint("invalid.ts", `import { Input } from "./types";
declare function read(): Promise<string>;
export function typed(input: Input): string { return input.value; }
export function unsafe(value: any): unknown { return value; }
export const unsafeValue = JSON.parse("{}");
read();
export async function noAwait(): Promise<number> { return 1; }
export async function unsafeReturn(): Promise<string> {
  try { return read(); } catch { return "fallback"; }
}
`, false, expectedRules);
    lint("duplicate.mjs", "export function duplicate(value, value) { return value; }", false, ["parser"]);
    lint("octal.mjs", "export const octal = 0123;", false, ["parser"]);
  }
  console.log("Lint regression checks passed: valid code accepted; required mistakes rejected.");
} finally {
  const actual = realpathSync(fixture);
  assert.equal(path.dirname(actual), source);
  assert.ok(path.basename(actual).startsWith("lint-regression-"));
  rmSync(actual, { recursive: true, force: true });
}
