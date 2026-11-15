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

CDK 2.277.0 bundles minimatch 10.2.6 despite npm overrides. The guarded install
step replaces only that dependency directory with a link to the exact root
minimatch 11.0.8, retaining its own transitive dependencies. It verifies CDK's
actual resolver. Remove this mitigation after CDK publishes a patched bundle.
Unknown versions fail installation for review. This is build tooling, excluded
from deployed Lambda handlers. GHSA-g3hv-75wg-m249 remains visible in npm's
tarball/lockfile advisory metadata; the lockfile is not falsified.

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
