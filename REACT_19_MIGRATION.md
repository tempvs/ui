# React 19 development release

Prepared 2026-11-14. Scope: React 19 and the UI prerequisites, deployed through the existing `master` -> dev workflow. Production promotion and the Node 26/MapLibre 6 fleet migration are separate work.

## Versions and compatibility decisions

| Component | Before | This release |
| --- | --- | --- |
| React / React DOM | 18.3.1 | 19.3.1 |
| React type packages | 18.x | 19.3.0 |
| React Intl | 6.8.9 | 12.1.7 |
| TypeScript | 4.9.5 | 5.9.3 |
| Bundler | react-scripts 5.0.1 | Vite 8.3.8 + React plugin 6.3.0 |
| Unit runner | CRA's Jest 27 | Explicit Jest / babel-jest / jsdom environment 30.5.2 |
| React Icons | 5.4.0 | 5.7.0 |

Intl 6 excludes React 19. Intl 12 requires TypeScript 5.4+ and ESM support, while CRA restricts TypeScript to 4.x. Vite removes that conflict. TypeScript 5.9 is the tested compatibility step; the wider plan's TypeScript 7 migration is not required for this React release. Jest is retained and upgraded to preserve existing module mocks and all original assertions; switching to Vitest is not a prerequisite and is not included.

React Router 6, React Bootstrap 2 and Lexical 0.22 already admit React 19 in their peer ranges and passed the tested component/editor flows. They retain their existing major versions. Node remains on the supported 24.x UI host line. Build targets are Chrome/Edge 111, Firefox 114 and Safari 16.4; browser automation for this release covers desktop/mobile Chromium.

## Implementation checklist

- [x] Install matched React/React DOM and React types without force/legacy-peer flags; validate clean `npm ci` and the resolved peer graph.
- [x] Upgrade Intl and replace removed `injectIntl` on ProfilePage, StashPage and StashItemPage with hook-based adapters.
- [x] Repair nullable ref signatures, initialize optional map refs, and disambiguate the custom image-action popover prop from the HTML attribute.
- [x] Replace CRA's HTML, environment types, proxy, scripts and implicit build dependencies with explicit Vite configuration.
- [x] Preserve port 3000, login `local=1`, Origin rewriting, cookies and native POST logout; verify with a local fixture upstream.
- [x] Retain basemap generation, root-relative assets, lazy renderer loading and `build/static` publishing/archive paths.
- [x] Replace the dynamic CommonJS period-image require with explicit asset imports, including the interwar SVG.
- [x] Keep service-worker unregister cleanup and remove unused CRA registration/sourcemap workarounds.
- [x] Own Jest transforms/polyfills/assets explicitly, including actual ESM Intl/FormatJS packages. Preserve basename asset assertions.
- [x] Replace all five browser fixture webpack pipelines with a shared, explicit esbuild pipeline supporting styles and images.
- [x] Check browser application, Jest and tooling types separately; run explicit hook linting and fail on warnings.
- [x] Run browser regressions against production output in CI, including fixtures previously omitted by the public-title filter.
- [x] Preserve HTML-last publishing and old hashed assets; change unversioned map-file headers to revalidate instead of one-year immutable caching.

## Local validation

- [x] Clean install and `npm ls`: no CRA dependency or invalid React peers.
- [x] Lint and application/test/tooling type checks.
- [x] **82 suites / 406 unit tests passed**, including all 404 prior tests and two Intl compatibility tests.
- [x] **Two hosting/proxy contract tests passed.**
- [x] **48 production-build browser tests passed** across desktop/mobile Chromium. Two optional credential-based onboarding cases skipped; mocked member/profile/session cases ran.
- [x] Production build and artifact check: MapLibre and MapCanvas are absent from initial-script source maps and remain in a lazy chunk.

One existing test now waits for the rendered empty-state text, rather than assuming that an API call means React has already committed its result. Its assertions are retained.

Initial entry scripts plus HTML module preloads total **164,122 gzip bytes**, compared with **145,383** for the prior dev entry (same Python gzip method, approximately +12.9%). The new main chunk alone is smaller, but comparing it alone would omit shared modules. This is a compatibility release, not a demonstrated browser-performance improvement. Production performance acceptance, broader browser coverage, archived-release rollback rehearsal and remaining dependency advisories stay open in the wider plan.

## CI and deployment gate

Push only the UI repository. The [UI workflow](https://github.com/tempvs/ui/actions/workflows/deploy-aws-dev.yml) must finish **Build** and **Deploy (dev)** successfully for the exact release commit. Verify dev HTML and every referenced initial asset against the tested build, then run deployed browser smoke checks. Record the commit, CI URL and observed deployment outcome in the workspace's `UI_REACT19_DEV_RELEASE_2026-11-14.json` and migration-plan checkpoint; do not infer deployment success from a successful push.
