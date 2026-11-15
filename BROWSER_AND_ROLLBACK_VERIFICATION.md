# Browser, authentication and rollback verification

- `npm run check`: native TypeScript 7 checks, typed ESLint, Jest, production build and hosting/proxy checks.
- `E2E_PREVIEW=true npm run e2e -- --workers=2`: production assets in Chromium, mobile Chrome, Firefox and WebKit. Covers map workers/WebGL recovery, ownership controls, wall pagination, search, editors and session navbar behavior.
- The protected dev deployment runs `npx playwright test --config=playwright.auth.config.ts` after publishing. Credentials are required, never silently skipped. The dedicated dev Cognito fixture has no privileged groups, no profile/data mutations and suppressed invitations. Credentials live only in GitHub's dev environment secrets. Traces, screenshots, videos and saved session state are disabled for real authentication.
- Real-session checks cover sign-in, secure HttpOnly cookies, reload/navigation persistence, cookie expiry clearing the avatar, and POST logout. The authentication config rejects every origin except `https://dev.tempvs.club`.

WebKit exercises Safari's engine. A separate protected macOS job uses Apple's
actual Safari WebDriver to check map rendering, real authentication, session
expiry, menu Escape and logout. iOS hardware remains an optional device check.

## Dev rollback rehearsal

1. Record the current passing master SHA. Confirm its `releases/SHA/index.html` archive exists in the dev bucket before changing dev.
2. Dispatch `deploy-aws-dev.yml` from master with `target_environment=dev` and an archived `rollback_release` SHA. The build is skipped; assets publish before HTML. Old hashed assets are retained.
3. Wait for deployment **and the real-session verification job**. Compare the served HTML with that exact archived index, GET its script/style assets and SPA routes.
4. Exercise an older CRA archive (`591ff6ecaf2f60b6d47deb05d64d4fa858cef999`) and a Vite archive (`877ec38f1df200b85726a6f95656e1d3950a5f0c`).
5. Always dispatch restoration of the recorded current SHA, including after a failed rehearsal check. Verify HTML/assets, public routes and all three real-authentication browser projects again.

This rehearsal targets dev only. Production promotion remains a separate requested action. Release-specific run IDs and hashes are recorded in the workspace migration evidence document.
