import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  createManifest,
  verifyAssets,
  promoteVerified,
  existingStaticEtags,
  equivalentSourceMaps,
} from "./release.mjs";
import { verifyService, previousDeployment } from "./service-health.mjs";

test("source-map comparison ignores only temporary IDs in virtual image modules", () => {
  const map = {
    version: 3,
    file: "LibraryPage-same.js",
    sources: [
      "../../src/library/images/modern.jpg",
      "../../src/library/LibraryPage.tsx",
    ],
    sourcesContent: [
      "export default import.meta.ROLLDOWN_FILE_URL_old",
      "export default function Page() {}",
    ],
    names: [],
    mappings: "AAAA",
  };
  const bytes = (value) => Buffer.from(JSON.stringify(value));
  const rebuilt = {
    ...map,
    sourcesContent: [
      "export default import.meta.ROLLDOWN_FILE_URL_new",
      map.sourcesContent[1],
    ],
  };
  assert.equal(
    equivalentSourceMaps(
      "static/LibraryPage-same.js.map",
      bytes(map),
      bytes(rebuilt),
    ),
    true,
  );
  assert.equal(
    equivalentSourceMaps("static/runtime.js", bytes(map), bytes(rebuilt)),
    false,
  );
  for (const changed of [
    { ...rebuilt, mappings: "BBBB" },
    { ...rebuilt, sources: ["different.jpg", map.sources[1]] },
    {
      ...rebuilt,
      sourcesContent: [
        rebuilt.sourcesContent[0],
        "export default function DifferentPage() {}",
      ],
    },
    {
      ...rebuilt,
      sourcesContent: [
        "export default '/different.jpg'",
        map.sourcesContent[1],
      ],
    },
  ])
    assert.equal(
      equivalentSourceMaps(
        "static/LibraryPage-same.js.map",
        bytes(map),
        bytes(changed),
      ),
      false,
    );
  const script = {
    ...map,
    sources: ["../../src/real-code.ts", map.sources[1]],
  };
  assert.equal(
    equivalentSourceMaps(
      "static/LibraryPage-same.js.map",
      bytes(script),
      bytes({ ...script, sourcesContent: rebuilt.sourcesContent }),
    ),
    false,
  );
  assert.equal(
    equivalentSourceMaps(
      "static/broken.js.map",
      Buffer.from("invalid"),
      bytes(map),
    ),
    false,
  );
});

test("immutable inventory follows bounded S3 pages without retaining unrelated releases", () => {
  const calls = [];
  const found = existingStaticEtags({
    bucket: "fixture",
    keys: ["static/active.js", "static/new.js"],
    run: (args) => {
      calls.push(args);
      assert.ok(args.includes("--no-paginate"));
      assert.equal(args[args.indexOf("--max-keys") + 1], "1000");
      if (calls.length === 1)
        return JSON.stringify({
          IsTruncated: true,
          NextContinuationToken: "next",
          Contents: [{ Key: "static/old.js", ETag: '"old"' }],
        });
      assert.equal(args[args.indexOf("--continuation-token") + 1], "next");
      return JSON.stringify({
        IsTruncated: false,
        Contents: [{ Key: "static/active.js", ETag: '"same"' }],
      });
    },
  });
  assert.equal(calls.length, 2);
  assert.deepEqual([...found], [["static/active.js", "same"]]);
  assert.throws(
    () =>
      existingStaticEtags({
        bucket: "fixture",
        keys: ["static/a.js"],
        run: () => JSON.stringify({ IsTruncated: true }),
      }),
    /Incomplete/,
  );
});

test("vendored health checks cover all public APIs and anonymous auth boundaries", async () => {
  const results = await verifyService({
    service: "all",
    stage: "dev",
    fetcher: async (input) => {
      const url = new URL(input);
      assert.equal(url.origin, "https://dev.tempvs.club");
      if (url.pathname === "/auth/login")
        return new Response(null, {
          status: 303,
          headers: {
            location:
              "https://auth.tempvs.club/oauth2/authorize?redirect_uri=https%3A%2F%2Fdev.tempvs.club%2Fauth%2Fcallback&identity_provider=Google",
          },
        });
      return Response.json(
        {},
        {
          status: /^(\/auth\/session|\/api\/(chat|notification|wall))/.test(
            url.pathname,
          )
            ? 401
            : 200,
        },
      );
    },
  });
  assert.equal(results.length, 14);
  let reads = 0;
  await assert.rejects(
    verifyService({
      service: "map",
      stage: "dev",
      attempts: 2,
      pause: async () => {},
      fetcher: async () => {
        reads++;
        return new Response("<html>bad gateway</html>");
      },
    }),
  );
  assert.equal(reads, 2);
});

test("vendored recovery history selects a successful deployment in the requested environment", async () => {
  const baseline = await previousDeployment({
    repository: "tempvs/ui",
    stage: "dev",
    token: "fixture-token",
    fetcher: async (url) => {
      if (url.includes("/statuses"))
        return Response.json([{ state: "success" }]);
      return Response.json([
        { id: 1, environment: "prod", sha: "a".repeat(40) },
        { id: 2, environment: "dev", sha: "b".repeat(40) },
      ]);
    },
  });
  assert.deepEqual(baseline, { id: 2, sha: "b".repeat(40) });
});
const a = "a".repeat(40),
  b = "b".repeat(40);
function fixture(t) {
  const directory = mkdtempSync(path.join(os.tmpdir(), "tempvs-release-test-"));
  t.after(() => {
    assert.equal(path.dirname(directory), path.resolve(os.tmpdir()));
    assert.ok(path.basename(directory).startsWith("tempvs-release-test-"));
    rmSync(directory, { recursive: true, force: true });
  });
  mkdirSync(path.join(directory, "static"));
  writeFileSync(
    path.join(directory, "index.html"),
    '<script src="/static/index-abcdefgh.js"></script>',
  );
  writeFileSync(
    path.join(directory, "static/index-abcdefgh.js"),
    'console.log("entry")',
  );
  writeFileSync(
    path.join(directory, "static/maplibre-gl-worker-abcdefgh.js"),
    "self.onmessage=()=>{}",
  );
  return { directory, manifest: createManifest(directory, a) };
}
test("candidate verification checks the complete runtime artifact and worker MIME", async (t) => {
  const { directory, manifest } = fixture(t);
  const requested = [];
  const result = await verifyAssets({
    base: "https://example.test",
    manifest,
    candidate: true,
    attempts: 1,
    fetcher: async (url) => {
      requested.push(url);
      const parsed = new URL(url);
      const file = parsed.pathname.replace(`/releases/${a}/`, "/").slice(1);
      return new Response(readFileSync(path.join(directory, file)), {
        headers: {
          "content-type": file.endsWith(".js")
            ? "text/javascript"
            : "text/html",
        },
      });
    },
  });
  assert.equal(result.files, 3);
  assert.ok(
    requested.some((url) => url.includes("/releases/" + a + "/index.html")),
  );
  assert.ok(
    requested.some(
      (url) => url === "https://example.test/static/index-abcdefgh.js",
    ),
  );
  await assert.rejects(
    verifyAssets({
      base: "https://example.test",
      manifest,
      attempts: 1,
      fetcher: async () => new Response("tampered"),
    }),
    /differs/,
  );
  await assert.rejects(
    verifyAssets({
      base: "https://example.test",
      manifest,
      candidate: true,
      attempts: 1,
      fetcher: async (url) =>
        new Response(
          readFileSync(
            path.join(
              directory,
              new URL(url).pathname.replace(`/releases/${a}/`, "/").slice(1),
            ),
          ),
          { headers: { "content-type": "text/plain" } },
        ),
    }),
    /worker MIME/,
  );
});
function protocol(overrides = {}) {
  const calls = [];
  const record = [];
  const options = {
    candidate: { release: a },
    baseline: { release: b },
    stage: "dev",
    stageAssets: async () => calls.push("stage"),
    verifyCandidate: async () => calls.push("verify-candidate"),
    publish: async () => calls.push("publish"),
    verifyLive: async () => calls.push("verify-live"),
    restore: async () => calls.push("restore"),
    verifyRecovery: async () => calls.push("verify-recovery"),
    mark: async (item) => calls.push("mark:" + item.release),
    record: (value) => record.push(value),
    ...overrides,
  };
  return { options, calls, record };
}
test("promotion only occurs after staging and candidate checks, then verifies live state", async () => {
  const { options, calls } = protocol();
  const result = await promoteVerified(options);
  assert.equal(result.status, "verified");
  assert.deepEqual(calls, [
    "stage",
    "verify-candidate",
    "publish",
    "verify-live",
    "mark:" + a,
  ]);
});
test("candidate rejection leaves the live entry point untouched", async () => {
  const { options, calls } = protocol({
    verifyCandidate: async () => {
      throw new Error("bad asset");
    },
  });
  await assert.rejects(promoteVerified(options), /bad asset/);
  assert.deepEqual(calls, ["stage"]);
});
test("post-promotion failure restores and verifies the baseline and still fails the candidate", async () => {
  const { options, calls, record } = protocol({
    verifyLive: async () => {
      throw new Error("bad live response");
    },
  });
  await assert.rejects(
    promoteVerified(options),
    (error) => error.recovered === true,
  );
  assert.deepEqual(calls, [
    "stage",
    "verify-candidate",
    "publish",
    "restore",
    "verify-recovery",
    "mark:" + b,
  ]);
  assert.equal(record.at(-1).phase, "restored");
});
test("partial publication failure also restores the baseline", async () => {
  const { options, calls } = protocol({
    publish: async () => {
      throw new Error("upload failed");
    },
  });
  await assert.rejects(
    promoteVerified(options),
    (error) => error.recovered === true,
  );
  assert.ok(calls.includes("restore"));
  assert.ok(calls.includes("verify-recovery"));
});
test("a failed recovery is surfaced once rather than entering an unsafe retry loop", async () => {
  let restores = 0;
  const { options, record } = protocol({
    verifyLive: async () => {
      throw new Error("candidate");
    },
    restore: async () => {
      restores++;
      throw new Error("recovery");
    },
  });
  await assert.rejects(promoteVerified(options), AggregateError);
  assert.equal(restores, 1);
  assert.equal(record.at(-1).phase, "recovery-failed");
});
test("expected-failure rehearsal is dev-only, restores a distinct baseline and succeeds", async () => {
  const { options, calls } = protocol({ rehearse: true });
  const result = await promoteVerified(options);
  assert.equal(result.status, "rehearsal-passed");
  assert.ok(calls.includes("restore"));
  await assert.rejects(
    promoteVerified({ ...options, stage: "prod" }),
    /dev archive/,
  );
  await assert.rejects(
    promoteVerified({ ...options, baseline: { release: a } }),
    /distinct/,
  );
});
