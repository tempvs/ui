# TypeScript Migration Plan

Migrate in small slices that keep JavaScript and TypeScript side by side:

1. Tooling baseline: TypeScript dependencies, `tsconfig.json`, `react-app-env.d.ts`, `npm run typecheck`, and Docker typechecking.
2. Leaf utilities and visual components: files without app state or API contracts, such as shared spinners, status icons, button wrappers, and file helpers.
3. Shared domain helpers: label builders, period helpers, role helpers, and API response normalizers with exported types.
4. API modules: type request payloads and response shapes one service area at a time.
5. Page components: migrate library and profile pages after their dependencies have typed boundaries.
6. Tighten compiler settings after most files are typed: remove `allowJs`, then enable stricter checks incrementally.
