# Toolchain and dependency compatibility

UI development, build and test tooling uses Node 26.13.1 and npm 11.20.0.
CI and local version-manager files select this version; package engines reject
unsupported installations. Node types are aligned to major 26.

Type checking/builds use stable TypeScript 7.0.2. Typed ESLint still needs
the TypeScript 6 compiler API. The supported side-by-side aliases remain:
`@typescript/native` supplies `tsc` 7; `typescript` aliases
`@typescript/typescript6` 6.0.2 for ESLint. This is a functional compatibility
requirement, not a security backport. No lint rules were disabled.

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
