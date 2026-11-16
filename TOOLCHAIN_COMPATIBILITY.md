# Toolchain and dependency compatibility

UI development, build and test tooling uses Node 26.13.1 and npm 11.20.0.
CI and local version-manager files select this version; package engines reject
unsupported installations. Node types are aligned to major 26.

Type checking uses TypeScript 7.0.2 directly. Oxlint 1.93.0 replaces ESLint;
the UI uses Oxlint's native React Hooks rules without a type-aware engine.
The TypeScript 6 API bridge and both compiler aliases have been removed.
Prettier and separate type checking remain unchanged.

## Lint rule preservation

`.oxlintrc.json` explicitly migrates the previous flat ESLint configuration,
including severities, options, TypeScript overrides and script/test exceptions.
Default rule categories are disabled so migration does not silently add a
different recommended ruleset. Existing inline exceptions use Oxlint directives.
`npm run lint:regression` checks valid code and deliberate mistakes under the
real project configuration; normal `npm run check` includes this check.

The UI retains the three existing checks: React Hooks call order (error),
effect dependencies (warning), and debugger statements (error). The lint command
continues to reject any warning. Regression checks verify the warning threshold
and the existing inline-suppression behavior as well as valid React code.

## Accepted upstream security advisories - 2026-11-15

The owner explicitly accepted these upstream vulnerabilities and requested
removal of the temporary source backports. `npm ci` no longer rewrites
dependency source files, and there is no custom postinstall patch hook.
Normal lint, type, test, build and artifact checks remain in place.

Jest 30.5.2 depends on deepmerge 4.3.1, which is affected by
GHSA-gcqx-w48m-w2h4. There is no patched upstream release. The package now
runs exactly as published; the previous own-property-write backport and its
install-time regression checks have been removed. This dependency belongs to
test tooling. React Router 7.18.5 and the glob 14.0.6 override remain.

The UI has no CDK dependency.

Audit warnings remain visible; their underlying source backports are no longer
applied. This change does not fix the upstream vulnerabilities. Reassess when
compatible upstream releases become available.

References:

- https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/
- https://github.com/advisories/GHSA-g3hv-75wg-m249
- https://github.com/advisories/GHSA-gcqx-w48m-w2h4

Lint references:

- https://oxc.rs/docs/guide/usage/linter/migrate-from-eslint.html
- https://oxc.rs/docs/guide/usage/linter/type-aware.html
