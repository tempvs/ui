import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const sha = (value) => {
  if (!/^[a-f0-9]{40}$/.test(value ?? ""))
    throw new Error("Release must be a full commit SHA");
  return value;
};
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const runtimeExtensions = new Set([".html", ".js", ".css", ".geojson"]);
export function createManifest(directory, release) {
  sha(release);
  const files = [];
  const walk = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isSymbolicLink())
        throw new Error("Release artifacts cannot contain symlinks");
      if (entry.isDirectory()) walk(full);
      else if (runtimeExtensions.has(path.extname(entry.name))) {
        const bytes = readFileSync(full);
        files.push({
          path: path.relative(directory, full).split(path.sep).join("/"),
          sha256: digest(bytes),
          bytes: bytes.length,
        });
      }
    }
  };
  walk(directory);
  files.sort((a, b) => a.path.localeCompare(b.path));
  if (
    !files.some((file) => file.path === "index.html") ||
    !files.some((file) => /static\/.*\.js$/.test(file.path)) ||
    !files.some((file) => /maplibre-gl-worker-[\w-]+\.js$/.test(file.path))
  )
    throw new Error("Incomplete UI release artifact");
  return { version: 1, release, files };
}
export async function verifyAssets({
  base,
  manifest,
  candidate = false,
  fetcher = fetch,
  attempts = 4,
  pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
}) {
  const queue = [...manifest.files];
  const check = async (file) => {
    const prefix =
      candidate && !file.path.startsWith("static/")
        ? `/releases/${sha(manifest.release)}/`
        : "/";
    let error;
    for (let attempt = 0; attempt < attempts; attempt++) {
      try {
        const response = await fetcher(base + prefix + file.path, {
          redirect: "manual",
          signal: AbortSignal.timeout(20000),
        });
        if (!response.ok)
          throw new Error("Asset HTTP " + response.status + " " + file.path);
        const bytes = Buffer.from(await response.arrayBuffer());
        if (digest(bytes) !== file.sha256)
          throw new Error("Asset differs from verified build: " + file.path);
        if (
          /maplibre-gl-worker-/.test(file.path) &&
          !/javascript/i.test(response.headers.get("content-type") ?? "")
        )
          throw new Error("Invalid map worker MIME");
        error = undefined;
        break;
      } catch (caught) {
        error = caught;
        if (attempt + 1 < attempts) await pause(2000);
      }
    }
    if (error) throw error;
  };
  await Promise.all(
    Array.from({ length: Math.min(6, queue.length) }, async () => {
      while (queue.length) {
        const file = queue.shift();
        if (file) await check(file);
      }
    }),
  );
  if (!candidate) {
    const index = manifest.files.find((file) => file.path === "index.html");
    for (const route of ["/map", "/library", "/clubs", "/events"]) {
      const response = await fetcher(base + route, {
        redirect: "manual",
        signal: AbortSignal.timeout(20000),
      });
      if (
        !response.ok ||
        digest(Buffer.from(await response.arrayBuffer())) !== index.sha256
      )
        throw new Error("SPA route differs from release: " + route);
    }
  }
  return { files: manifest.files.length, routes: candidate ? 0 : 4 };
}
export async function promoteVerified({
  candidate,
  baseline,
  stage,
  stageAssets,
  verifyCandidate,
  publish,
  verifyLive,
  restore,
  verifyRecovery,
  mark,
  record = () => {},
  rehearse = false,
}) {
  sha(candidate.release);
  sha(baseline.release);
  if (!["dev", "prod"].includes(stage))
    throw new Error("Invalid release stage");
  if (rehearse && (stage !== "dev" || candidate.release === baseline.release))
    throw new Error("Recovery rehearsal requires a distinct dev archive");
  let promotionBegan = false;
  try {
    record({
      phase: "staging",
      candidate: candidate.release,
      previous: baseline.release,
    });
    await stageAssets(candidate);
    await verifyCandidate(candidate);
    record({ phase: "candidate-verified" });
    promotionBegan = true;
    await publish(candidate);
    if (rehearse) throw new Error("Expected dev recovery rehearsal");
    await verifyLive(candidate);
    await mark(candidate);
    record({ phase: "verified", release: candidate.release });
    return {
      status: "verified",
      release: candidate.release,
      previous: baseline.release,
    };
  } catch (error) {
    if (!promotionBegan) {
      record({ phase: "rejected-before-promotion", error: error.message });
      throw error;
    }
    record({ phase: "restoring", error: error.message });
    try {
      await restore(baseline);
      await verifyRecovery(baseline);
      await mark(baseline);
      record({ phase: "restored", release: baseline.release });
    } catch (recoveryError) {
      record({ phase: "recovery-failed", error: recoveryError.message });
      throw new AggregateError(
        [error, recoveryError],
        "Candidate failed and recovery could not be verified",
      );
    }
    if (rehearse)
      return {
        status: "rehearsal-passed",
        restored: baseline.release,
        rejected: candidate.release,
      };
    const failure = new Error(
      "Candidate failed; previous verified release restored",
      { cause: error },
    );
    failure.recovered = true;
    throw failure;
  }
}

function aws(args) {
  try {
    return execFileSync("aws", args, {
      encoding: "utf8",
      timeout: 650000,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    const failure = new Error(
      `AWS release operation failed: ${args[0]} ${args[1]}`,
    );
    failure.details = String(error.stderr ?? "");
    throw failure;
  }
}
class Storage {
  constructor({ bucket, distribution, temporary }) {
    this.bucket = bucket;
    this.distribution = distribution;
    this.temporary = temporary;
  }
  object(key) {
    return `s3://${this.bucket}/${key}`;
  }
  read(key) {
    try {
      return aws(["s3", "cp", this.object(key), "-", "--only-show-errors"]);
    } catch (error) {
      if (/NoSuchKey|404|Not Found/.test(error.details)) return null;
      throw error;
    }
  }
  archive(release, directory) {
    sha(release);
    mkdirSync(directory, { recursive: true });
    aws([
      "s3",
      "sync",
      this.object(`releases/${release}/`),
      directory,
      "--only-show-errors",
    ]);
    if (!existsSync(path.join(directory, "index.html")))
      throw new Error("Release archive is missing index.html");
  }
  stage(candidate) {
    const manifest = createManifest(candidate.directory, candidate.release);
    candidate.manifest = manifest;
    const archivedIndex = this.read(`releases/${candidate.release}/index.html`);
    if (
      archivedIndex !== null &&
      digest(Buffer.from(archivedIndex)) !==
        manifest.files.find((file) => file.path === "index.html").sha256
    )
      throw new Error("Archived release SHA has different entry-point content");
    writeFileSync(
      path.join(candidate.directory, "release-manifest.json"),
      JSON.stringify(manifest, null, 2) + "\n",
    );
    // Content-addressed assets must never overwrite a different active asset.
    const existing =
      JSON.parse(
        aws([
          "s3api",
          "list-objects-v2",
          "--bucket",
          this.bucket,
          "--prefix",
          "static/",
          "--output",
          "json",
        ]),
      ).Contents ?? [];
    const byKey = new Map(
      existing.map((object) => [object.Key, object.ETag?.replaceAll('"', "")]),
    );
    for (const entry of readdirSync(path.join(candidate.directory, "static"), {
      withFileTypes: true,
    })) {
      if (!entry.isFile()) throw new Error("Unexpected nested static artifact");
      const key = "static/" + entry.name;
      const etag = byKey.get(key);
      if (!etag) continue;
      const file = path.join(candidate.directory, key);
      const md5 = createHash("md5").update(readFileSync(file)).digest("hex");
      if (etag === md5) continue;
      const comparison = path.join(this.temporary, "immutable-check");
      aws(["s3", "cp", this.object(key), comparison, "--only-show-errors"]);
      if (digest(readFileSync(comparison)) !== digest(readFileSync(file)))
        throw new Error("Immutable asset collision: " + key);
    }
    aws([
      "s3",
      "sync",
      candidate.directory,
      this.object(`releases/${candidate.release}/`),
      "--only-show-errors",
    ]);
    aws([
      "s3",
      "sync",
      path.join(candidate.directory, "static"),
      this.object("static/"),
      "--cache-control",
      "public,max-age=31536000,immutable",
      "--only-show-errors",
    ]);
  }
  publish(candidate) {
    if (existsSync(path.join(candidate.directory, "maps")))
      aws([
        "s3",
        "sync",
        path.join(candidate.directory, "maps"),
        this.object("maps/"),
        "--cache-control",
        "public,max-age=0,must-revalidate",
        "--only-show-errors",
      ]);
    for (const entry of readdirSync(candidate.directory, {
      withFileTypes: true,
    }))
      if (
        entry.isFile() &&
        entry.name !== "index.html" &&
        entry.name !== "release.json"
      )
        aws([
          "s3",
          "cp",
          path.join(candidate.directory, entry.name),
          this.object(entry.name),
          "--cache-control",
          "public,max-age=3600",
          "--only-show-errors",
        ]);
    aws([
      "s3",
      "cp",
      path.join(candidate.directory, "index.html"),
      this.object("index.html"),
      "--content-type",
      "text/html; charset=utf-8",
      "--cache-control",
      "no-cache,no-store,must-revalidate",
      "--only-show-errors",
    ]);
    const invalidation = JSON.parse(
      aws([
        "cloudfront",
        "create-invalidation",
        "--distribution-id",
        this.distribution,
        "--paths",
        "/*",
        "--output",
        "json",
      ]),
    );
    aws([
      "cloudfront",
      "wait",
      "invalidation-completed",
      "--distribution-id",
      this.distribution,
      "--id",
      invalidation.Invalidation.Id,
    ]);
  }
  mark(candidate) {
    const marker = path.join(this.temporary, "release.json");
    writeFileSync(
      marker,
      JSON.stringify({
        release: candidate.release,
        verifiedAt: new Date().toISOString(),
        run: process.env.GITHUB_RUN_ID,
      }) + "\n",
    );
    aws([
      "s3",
      "cp",
      marker,
      this.object("release.json"),
      "--content-type",
      "application/json",
      "--cache-control",
      "no-store",
      "--only-show-errors",
    ]);
  }
}
async function main() {
  const stage = process.env.TARGET_ENVIRONMENT;
  if (
    !["dev", "prod"].includes(stage) ||
    (stage === "prod" && process.env.GITHUB_REF_NAME !== "master")
  )
    throw new Error("Invalid release environment/ref");
  const expectedAccount = stage === "prod" ? "527159817313" : "750390206482";
  if (process.env.AWS_ACCOUNT_ID !== expectedAccount)
    throw new Error("Release account does not match public origin");
  const base =
    stage === "prod" ? "https://tempvs.club" : "https://dev.tempvs.club";
  const temporary = path.join(process.env.RUNNER_TEMP, "ui-verified-release");
  mkdirSync(temporary, { recursive: true });
  const report = path.join(process.env.RUNNER_TEMP, "ui-release.json");
  const record = (update) => {
    const current = existsSync(report)
      ? JSON.parse(readFileSync(report, "utf8"))
      : {};
    writeFileSync(
      report,
      JSON.stringify(
        { ...current, ...update, updatedAt: new Date().toISOString() },
        null,
        2,
      ) + "\n",
    );
  };
  const health = await import(
    pathToFileURL(process.env.PUBLIC_PROBE_SCRIPT).href
  );
  const storage = new Storage({
    bucket: process.env.WEB_BUCKET_NAME,
    distribution: process.env.CLOUDFRONT_DISTRIBUTION_ID,
    temporary,
  });
  const marker = storage.read("release.json");
  const previous = marker
    ? { sha: sha(JSON.parse(marker).release) }
    : await health.previousDeployment({
        repository: process.env.GITHUB_REPOSITORY,
        stage,
        token: process.env.GH_TOKEN,
      });
  const baseline = {
    release: previous.sha,
    directory: path.join(temporary, "previous"),
  };
  storage.archive(baseline.release, baseline.directory);
  baseline.manifest = createManifest(baseline.directory, baseline.release);
  if (
    digest(Buffer.from(storage.read("index.html") ?? "")) !==
    baseline.manifest.files.find((file) => file.path === "index.html").sha256
  )
    throw new Error("Current entry point does not match the recovery archive");
  const rehearse = Boolean(process.env.REHEARSAL_RELEASE);
  if (rehearse && stage !== "dev")
    throw new Error("Recovery rehearsal is dev-only");
  const release = sha(
    process.env.REHEARSAL_RELEASE ||
      process.env.ROLLBACK_RELEASE ||
      process.env.GITHUB_SHA,
  );
  const candidate = { release, directory: path.resolve("build") };
  if (process.env.REHEARSAL_RELEASE || process.env.ROLLBACK_RELEASE) {
    candidate.directory = path.join(temporary, "candidate");
    storage.archive(release, candidate.directory);
  }
  candidate.manifest = createManifest(candidate.directory, release);
  const probe = () => health.verifyService({ service: "all", stage, release });
  const verifyLive = async (item) => {
    await verifyAssets({ base, manifest: item.manifest });
    await probe();
  };
  const result = await promoteVerified({
    candidate,
    baseline,
    stage,
    rehearse,
    record,
    stageAssets: (item) => storage.stage(item),
    verifyCandidate: async (item) => {
      await verifyAssets({ base, manifest: item.manifest, candidate: true });
      await probe();
    },
    publish: (item) => storage.publish(item),
    verifyLive,
    restore: (item) => {
      storage.stage(item);
      storage.publish(item);
    },
    verifyRecovery: verifyLive,
    mark: (item) => storage.mark(item),
  });
  record({ result });
  console.log(JSON.stringify(result));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
