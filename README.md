# ui

Tempvs UI

The app uses React 19, React Intl 12 and Vite 8. Use Node.js **26.13.1 LTS**
and npm **11.20.0**, then run `npm ci`. `.node-version` and `.nvmrc` pin the
tested version for local development; CI reads `.node-version`. Install/select
that version with your Node version manager before running the UI commands.
The project rejects unsupported Node/npm versions during installation.

Interactive maps use MapLibre 6 and require WebGL2. The renderer and its matching,
content-hashed worker load only when a map opens; unsupported graphics retain the
surrounding page and result lists with a retry/fallback message.

The wall uses backend relationship discovery and resumable feed checkpoints
(`discovery=server`); deploy the Wall service before this UI release. Empty
advancing pages are followed automatically up to four requests, with Load more
available afterward. Reload wall restarts expired or failed pagination.

Search code loads on first interaction, preserving typed text and the `/`
shortcut. The HTML entry plus module preloads measured 141,757 gzip bytes versus
164,128 before this change (13.6% lower; CSS and lazy routes excluded). This is
an artifact transfer comparison, not a claim about end-user latency.

Map reads share cancellation by consumer: leaving one card preserves other
subscribers, while leaving the last aborts pending transports. Completed scope
reads retain at most 64 entries for 30 seconds; image/place caches retain at most
500 entries, with a 15-second TTL for missing thumbnails. Image/place queues use
at most two concurrent batches. Projection/place batching covers all supplied
IDs. Private graphs above 150 markers render avatar elements within the viewport
and restore them after camera movement; graph data and fit points stay complete.
Static previews reuse their geographic background when only images change.

- `npm start`: development server at `http://localhost:3000`.
- `npm run check`: lint, application/test/tooling types, unit tests, production build and hosting/proxy contract tests.
- `npm run build`: generate the local basemap and production files in `build/`, with hashed bundles in `build/static/`.
- `npm run preview`: serve the existing production build on port 3000.
- `npm run e2e`: Chromium, mobile Chrome, Firefox and WebKit regressions against the dev server. Set `E2E_PREVIEW=true` to test the production build instead.

Development and preview proxy `/api` and `/auth` to `https://dev.tempvs.club`; override with server-only `TEMPVS_DEV_ORIGIN`. The login proxy preserves the local callback parameter and Origin rewrite. No server environment variables are exposed as browser configuration.

CI tests the production build, including the real editor, navbar/session, map and standalone component fixtures. After dev deployment, protected jobs require the dedicated `E2E_EMAIL` and `E2E_PASSWORD` fixture secrets and verify real sessions in Chrome, Firefox, WebKit and actual macOS Safari. See [browser/authentication verification](BROWSER_AND_ROLLBACK_VERIFICATION.md), [toolchain compatibility](TOOLCHAIN_COMPATIBILITY.md) and the historical [React 19 migration record](REACT_19_MIGRATION.md).

The UI uses Cognito through the same-origin authentication edge. Google and email/password sign-in, registration, session refresh, and logout are supported by the AWS deployment at `dev.tempvs.club`.

The [AWS UI deployment workflow](.github/workflows/deploy-aws-dev.yml) runs automatically for `master`: its `build` job tests, type-checks, builds, and uploads an artifact; its separate `deploy` job downloads that artifact, archives it in a private versioned S3 bucket, publishes it to CloudFront, and supports restoring an archived commit SHA when run manually. It requires the `dev` GitHub environment variables `AWS_DEPLOY_ROLE_ARN`, `WEB_BUCKET_NAME`, and `CLOUDFRONT_DISTRIBUTION_ID` from the `tempvs-dev-web` CloudFormation outputs.

The UI's AWS infrastructure is intentionally kept in the separate [`aws-infrastructure.cdk`](../aws-infrastructure.cdk) repository, in `WebStack`. The UI workflow does not run CDK; it deploys assets only after that stack has provisioned the bucket, distribution, and scoped GitHub OIDC role.
