# Verified UI releases

Pushes to `master` build and deploy to **dev**. Production still requires the
`Build and deploy UI` workflow's explicit `target_environment=prod` dispatch
from `master` and its protected environment configuration.

The deployment action stages the build under `releases/<commit>/`, checks the
runtime files against SHA-256 hashes, verifies the MapLibre worker MIME type,
and checks public APIs and anonymous authentication boundaries. It uploads
immutable static files before publishing `index.html`. After CloudFront's
invalidation completes, it verifies the live files, SPA routes and APIs again.
Only a verified release becomes the `release.json` recovery baseline.

A failure after publication starts restores the previous verified archive,
invalidates CloudFront, and verifies recovery. The candidate workflow still
fails even if recovery succeeds. A failure before publication leaves the
current entry point in place. Inspect the `ui-release-<run>-<attempt>` artifact
for the candidate, baseline and recovery outcome.

## Manual recovery and dev rehearsal

- To restore an archived build, dispatch the workflow from trusted `master`,
  select the environment, and set `rollback_release` to its full commit SHA.
  The archived build must exist in that environment's bucket.
- To exercise automatic recovery, dispatch with `target_environment=dev` and
  `rehearsal_release` set to a different archived commit. The drill briefly
  publishes that build, triggers an expected verification failure, restores
  the current verified build, and checks it again. A successful drill reports
  `rehearsal-passed`. This option is rejected for production.
- Deploy the infrastructure changes granting root entry-point/marker reads
  and CloudFront invalidation status reads before using this workflow in a
  new environment. Missing recovery history or an inconsistent current
  entry point stops the deployment before publication.

The shared backend release action similarly verifies live HTTP health and
redeploys the previous successful environment commit on failure, using its
Node version and lockfile. Application recovery does not reverse database
changes or other irreversible operations. Health probes cover public reads
and anonymous protected-route boundaries; they do not create production data
or replace authenticated browser tests. Dev retains its real-session tests
in Chrome, Firefox, WebKit and Apple's Safari.

The UI vendors the health helper in `scripts/service-health.mjs` from reviewed
shared tools revision `44c50c0ccc04c4ad32d85a84ea852b0b31723cfc`. This permits the
UI workflow to run without access to a private repository. Update its probes
together with the shared backend helper when API contracts change.

## Performance behavior

The wall renders its visible variable-height cards and a small overscan while
retaining all fetched activities and pagination state. The focused card and
its immediate neighbors remain mounted for keyboard navigation. The keyboard
accessible **Show all loaded updates** control restores the full loaded list
for assistive technology or browser find.

Public Map reads use the explicit anonymous `/api/public/map` namespace and
omit browser credentials. CloudFront caches eligible JSON responses for up
to 60 seconds, with all query parameters in the cache key. Cookies and tokens
are excluded; session-aware paths, writes, errors and private responses stay
uncached. Public updates can therefore take up to 60 seconds to appear in a
subsequent cached read. Explicit `cache: "no-store"` reads retain the original
uncached Map route.
