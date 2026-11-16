# Toolchain and dependency compatibility

UI development, build and test tooling uses Node 26.13.1 LTS and npm 11.20.0.
CI and local version-manager files select this version; package engines reject
unsupported installations. Node types are aligned to major 26.

Type checking/builds use stable TypeScript 7.0.2. Repositories with typed ESLint
use Microsoft's supported side-by-side aliases: `@typescript/native` supplies
`tsc` 7, while `typescript` aliases `@typescript/typescript6` 6.0.2 for the
compiler API required by typescript-eslint. Do not remove the bridge until the
linter supports the new compiler API. No lint rules were disabled.

## Temporary security mitigations

`npm ci` runs `scripts/dependency-security.mjs --apply`; `npm run security:check`
verifies the effective dependency resolution and exploit regression. Installs
with `--ignore-scripts` must explicitly run postinstall before other tooling.

The UI has no CDK dependency. CDK/minimatch mitigation remains owned by the
backend and infrastructure repositories; the UI install script contains no CDK
patching logic.

The UI also upgrades React Router to 7.18.5 and glob to 14.0.6. Jest 30.5.2
still depends on deepmerge 4.3.1, for which no patched release exists. Its three
JavaScript entrypoints are patched reproducibly to define own data properties
instead of invoking prototype setters. Tests cover poisoned target/source,
normal merges, arrays, symbols and merge.all. Keep GHSA-gcqx-w48m-w2h4 visible
until upstream releases a fix; do not downgrade Jest or suppress the advisory.

References:
- https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/
- https://github.com/advisories/GHSA-g3hv-75wg-m249
- https://github.com/advisories/GHSA-gcqx-w48m-w2h4

## Upstream removal gate rechecked 2026-11-15

- typescript-eslint 8.72.2 still requires TypeScript `<6.1.0`; retain the official
  TypeScript 6 API bridge while the native TypeScript 7 compiler runs checks.
- Latest Jest remains 30.5.2 and latest deepmerge remains vulnerable 4.3.1. Retain
  the own-property-write backport and its exploit regression checks.
- Latest aws-cdk-lib remains 2.277.0 with bundled minimatch 10.2.6; backend and
  infrastructure backports remain required. No upstream fix was available to
  remove these protections safely. No lint rules or security checks were removed.
