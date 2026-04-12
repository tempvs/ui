# TypeScript Migration Status

Completed:

1. Tooling baseline: TypeScript dependencies, `tsconfig.json`, `react-app-env.d.ts`, `npm run typecheck`, and Docker typechecking.
2. Leaf utilities and visual components: shared spinners, status icons, button wrappers, file helpers, and shared layout components.
3. Shared domain helpers: label builders, period helpers, role helpers, and API response normalizers with exported types.
4. API modules: library, profile, and stash APIs.
5. Page components: library and profile/stash pages.
6. Compiler tightening: `allowJs` is disabled and `strict` mode is enabled. `src/setupProxy.js` remains JavaScript because Create React App expects that proxy hook file.

Remaining cleanup:

1. Continue tightening domain payloads where backend contracts are currently inferred from UI usage.
2. If autosave behavior grows further, consider extracting a higher-level draft/status hook. Timer cleanup itself is already shared in `src/util/timers.ts`.
