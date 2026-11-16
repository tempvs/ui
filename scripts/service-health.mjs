import {
  appendFileSync,
  existsSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
const zero = "00000000-0000-4000-8000-000000000000";
export const probes = {
  profile: ["/api/profile/profile/search?type=CLUB&limit=1", 200],
  club: ["/api/club/clubs?limit=1", 200],
  event: ["/api/events?limit=1", 200],
  library: ["/api/library/source/find?limit=1", 200],
  map: ["/api/map/places/search?q=ro&limit=1", 200],
  image: [`/api/images/profile/${zero}?limit=1`, 200],
  post: [`/api/post/posts?targetType=PROFILE&targetId=${zero}&limit=1`, 200],
  comment: [`/api/comment?targetType=POST&targetId=${zero}`, 200],
  stash: [`/api/stash/groups/items?groupIds=${zero}`, 200],
  chat: [`/api/chat/conversations?profileId=${zero}`, 401],
  notification: ["/api/notification?limit=1", 401],
  wall: [`/api/wall?profileId=${zero}&limit=1`, 401],
};
export function releaseBase(stage) {
  if (!["dev", "prod"].includes(stage))
    throw new Error("Invalid release stage");
  return stage === "prod" ? "https://tempvs.club" : "https://dev.tempvs.club";
}
export async function verifyService({
  service,
  stage,
  release = "probe",
  fetcher = fetch,
  attempts = 4,
  pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
}) {
  const base = releaseBase(stage);
  const selected =
    service === "all" ? Object.entries(probes) : [[service, probes[service]]];
  if (selected.some(([, probe]) => !probe))
    throw new Error("Unknown service health probe");
  const results = [];
  for (const [name, [pathname, status]] of selected) {
    let error;
    for (let attempt = 0; attempt < attempts; attempt++) {
      try {
        const url = new URL(pathname, base);
        url.searchParams.set("__release", release);
        const response = await fetcher(url, {
          redirect: "manual",
          signal: AbortSignal.timeout(10000),
          headers: { Accept: "application/json" },
        });
        if (
          response.status !== status ||
          !/application\/json/i.test(response.headers.get("content-type") ?? "")
        )
          throw new Error(`${name} health returned HTTP ${response.status}`);
        const body = await response.json();
        if (!body || typeof body !== "object" || Array.isArray(body))
          throw new Error(`${name} health returned an invalid JSON envelope`);
        results.push({ service: name, status: response.status });
        error = undefined;
        break;
      } catch (caught) {
        error = caught;
        if (attempt + 1 < attempts) await pause(2000);
      }
    }
    if (error) throw error;
  }
  if (service === "all") {
    const session = await fetcher(base + "/auth/session", {
      redirect: "manual",
      signal: AbortSignal.timeout(10000),
    });
    if (session.status !== 401)
      throw new Error("Anonymous session boundary failed");
    results.push({ service: "auth-session", status: 401 });
    const login = await fetcher(
      base + "/auth/login?provider=Google&returnTo=%2Fmap",
      { redirect: "manual", signal: AbortSignal.timeout(10000) },
    );
    if (login.status !== 303) throw new Error("Google login redirect failed");
    const location = new URL(login.headers.get("location"));
    if (
      location.protocol !== "https:" ||
      !(
        location.hostname === "auth.tempvs.club" ||
        location.hostname.endsWith(".amazoncognito.com")
      ) ||
      location.searchParams.get("redirect_uri") !== base + "/auth/callback" ||
      location.searchParams.get("identity_provider") !== "Google"
    )
      throw new Error("Google login redirect configuration failed");
    results.push({ service: "google-login", status: 303 });
  }
  return results;
}
export async function previousDeployment({
  repository,
  stage,
  token,
  fetcher = fetch,
}) {
  releaseBase(stage);
  if (!/^tempvs\/[a-z][a-z0-9.-]*$/.test(repository) || !token)
    throw new Error("Missing release repository/token");
  const request = async (endpoint) => {
    const response = await fetcher(
      "https://api.github.com/repos/" + repository + endpoint,
      {
        headers: {
          Authorization: "Bearer " + token,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        signal: AbortSignal.timeout(10000),
      },
    );
    if (!response.ok)
      throw new Error("Deployment history HTTP " + response.status);
    const value = await response.json();
    if (!Array.isArray(value)) throw new Error("Invalid deployment history");
    return value;
  };
  for (let page = 1; page <= 3; page++) {
    const deployments = await request(
      `/deployments?environment=${stage}&per_page=30&page=${page}`,
    );
    for (const deployment of deployments) {
      if (
        deployment.environment !== stage ||
        !/^[a-f0-9]{40}$/.test(deployment.sha) ||
        !Number.isSafeInteger(deployment.id)
      )
        continue;
      const statuses = await request(
        `/deployments/${deployment.id}/statuses?per_page=1`,
      );
      if (statuses[0]?.state === "success")
        return { sha: deployment.sha, id: deployment.id };
    }
    if (deployments.length < 30) break;
  }
  throw new Error(
    "No successful deployment baseline; establish and verify the initial release before automatic recovery",
  );
}
function receipt(update) {
  const file = path.join(
    process.env.RUNNER_TEMP ?? process.cwd(),
    "service-release.json",
  );
  const previous = existsSync(file)
    ? JSON.parse(readFileSync(file, "utf8"))
    : {};
  writeFileSync(
    file,
    JSON.stringify(
      { ...previous, ...update, updatedAt: new Date().toISOString() },
      null,
      2,
    ) + "\n",
  );
}
async function main() {
  const mode = process.argv[2];
  const stage = process.env.DEPLOY_STAGE;
  const service =
    process.env.RELEASE_SERVICE ??
    process.env.GITHUB_REPOSITORY?.split("/")[1]?.replace(
      /-monorepo\.lambda$/,
      "",
    );
  if (mode === "baseline") {
    const baseline = await previousDeployment({
      repository: process.env.GITHUB_REPOSITORY,
      stage,
      token: process.env.GH_TOKEN,
    });
    appendFileSync(process.env.GITHUB_OUTPUT, `previous_sha=${baseline.sha}\n`);
    receipt({ stage, service, candidate: process.env.GITHUB_SHA, baseline });
  } else if (mode === "probe") {
    const results = await verifyService({
      service,
      stage,
      release: process.env.GITHUB_SHA,
    });
    receipt({ [process.env.RELEASE_PHASE ?? "health"]: results });
    console.log(JSON.stringify({ stage, checks: results }));
  } else if (mode === "record") {
    receipt({
      deploy: process.env.DEPLOY_OUTCOME,
      verify: process.env.VERIFY_OUTCOME,
      rollback: process.env.ROLLBACK_OUTCOME,
    });
  } else throw new Error("Unknown release command");
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
