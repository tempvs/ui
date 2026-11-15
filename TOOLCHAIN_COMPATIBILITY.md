# Toolchain and dependency compatibility

Type checking/builds use stable TypeScript 7.0.2. Repositories with typed ESLint
use Microsoft's supported side-by-side aliases: `@typescript/native` supplies
`tsc` 7, while `typescript` aliases `@typescript/typescript6` 6.0.2 for the
compiler API required by typescript-eslint. Do not remove the bridge until the
linter supports the new compiler API. No lint rules were disabled.

## Temporary security mitigations

`npm ci` runs `scripts/dependency-security.mjs --apply`; `npm run security:check`
verifies the effective dependency resolution and exploit regression. Installs
with `--ignore-scripts` must explicitly run postinstall before other tooling.

CDK 2.277.0 bundles minimatch 10.2.6 despite npm overrides. The install step
backports upstream commit 77a0f5c4b80bdc641c3c930a1d9edf5ad2db57f8 to both
CommonJS and ESM entrypoints. It caps pattern amplification and skips quadratic
deduplication above 1000 entries. Exact original/patched SHA-256 hashes prevent
unexpected source changes. Regression checks exercise bounded globparts and
large-set short-circuiting, plus ordinary matches. Package and lock metadata
remain truthful; npm ls stays valid. The scoped override retains this patched
vendored 10.2.6 while other minimatch dependencies use 11.0.8. Remove the backport
after CDK publishes a patched bundle. GHSA-g3hv-75wg-m249 remains visible in npm
advisory metadata. CDK is excluded from deployed application handler bundles.

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
