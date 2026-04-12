# TypeScript Migration Status

Completed:

1. Tooling baseline: TypeScript dependencies, `tsconfig.json`, `react-app-env.d.ts`, `npm run typecheck`, and Docker typechecking.
2. Leaf utilities and visual components: shared spinners, status icons, button wrappers, file helpers, and shared layout components.
3. Shared domain helpers: label builders, period helpers, role helpers, and API response normalizers with exported types.
4. API modules: library, profile, and stash APIs.
5. Page components: library and profile/stash pages.
6. Compiler tightening: `allowJs` is disabled. `src/setupProxy.js` remains JavaScript because Create React App expects that proxy hook file.

Remaining cleanup:

1. Replace transitional `any` in `ProfilePage.tsx`, `StashPanel.tsx`, `StashPage.tsx`, `profileApi.ts`, and `stashApi.ts` with shared profile/stash payload types.
2. Consider enabling stricter compiler flags incrementally, starting with `noImplicitAny`.
3. Extract repeated save-status draft/timer logic from source, profile, and stash editing flows into a shared hook after the data types are narrowed.
