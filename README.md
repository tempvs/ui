# ui

Tempvs UI

The app uses React 19, React Intl 12 and Vite 8. Use Node.js 24.11 or newer, then run `npm ci`.

Interactive maps use MapLibre 6 and require WebGL2. The renderer and its matching,
content-hashed worker load only when a map opens; unsupported graphics retain the
surrounding page and result lists with a retry/fallback message.

- `npm start`: development server at `http://localhost:3000`.
- `npm run check`: lint, application/test/tooling types, unit tests, production build and hosting/proxy contract tests.
- `npm run build`: generate the local basemap and production files in `build/`, with hashed bundles in `build/static/`.
- `npm run preview`: serve the existing production build on port 3000.
- `npm run e2e`: desktop and mobile Chromium regressions against the dev server. Set `E2E_PREVIEW=true` to test the production build instead.

Development and preview proxy `/api` and `/auth` to `https://dev.tempvs.club`; override with server-only `TEMPVS_DEV_ORIGIN`. The login proxy preserves the local callback parameter and Origin rewrite. No server environment variables are exposed as browser configuration.

CI tests the production build, including the real editor, navbar/session, map and standalone component fixtures. The optional authenticated onboarding test needs `E2E_EMAIL` and `E2E_PASSWORD`; mocked member/session regressions do not need credentials. See [React 19 migration record](REACT_19_MIGRATION.md).

The UI uses Cognito through the same-origin authentication edge. Google and email/password sign-in, registration, session refresh, and logout are supported by the AWS deployment at `dev.tempvs.club`.

The [AWS UI deployment workflow](.github/workflows/deploy-aws-dev.yml) runs automatically for `master`: its `build` job tests, type-checks, builds, and uploads an artifact; its separate `deploy` job downloads that artifact, archives it in a private versioned S3 bucket, publishes it to CloudFront, and supports restoring an archived commit SHA when run manually. It requires the `dev` GitHub environment variables `AWS_DEPLOY_ROLE_ARN`, `WEB_BUCKET_NAME`, and `CLOUDFRONT_DISTRIBUTION_ID` from the `tempvs-dev-web` CloudFormation outputs.

The UI's AWS infrastructure is intentionally kept in the separate [`aws-infrastructure.cdk`](../aws-infrastructure.cdk) repository, in `WebStack`. The UI workflow does not run CDK; it deploys assets only after that stack has provisioned the bucket, distribution, and scoped GitHub OIDC role.
