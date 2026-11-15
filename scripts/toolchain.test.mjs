import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createServer as createHttpServer } from "node:http";
import { once } from "node:events";
import path from "node:path";
import test from "node:test";
import { createServer } from "vite";

test("the production artifact preserves hosting paths and defers the map renderer", () => {
  const html = readFileSync("build/index.html", "utf8");
  const scripts = [...html.matchAll(/(?:src|href)="(\/static\/[^\"]+\.js)"/g)]
    .map((match) => match[1]);
  assert.ok(scripts.length > 0);
  for (const script of scripts) {
    const map = JSON.parse(readFileSync(path.join("build", `${script}.map`), "utf8"));
    assert.ok(!map.sources.some((source) => /maplibre-gl|\/MapCanvas\.tsx$/.test(source)),
      `${script} must not eagerly include the renderer`);
  }
  const basemap = JSON.parse(readFileSync("build/maps/basemap.geojson", "utf8"));
  assert.equal(basemap.type, "FeatureCollection");
  assert.ok(basemap.features.length > 0);
  assert.ok(!html.includes("%PUBLIC_URL%"));
  const workers = readdirSync("build/static").filter((name) => /^maplibre-gl-worker-[\w-]+\.js$/.test(name));
  assert.equal(workers.length, 1, "The map needs one matching content-hashed worker asset");
  assert.ok(!html.includes(workers[0]), "The worker must remain behind the lazy map import");
  const rendererFiles = readdirSync("build/static").filter((name) => /^MapCanvas-.*\.js$/.test(name));
  assert.ok(rendererFiles.some((name) => readFileSync(path.join("build/static", name), "utf8").includes(workers[0])),
    "The renderer must reference the emitted worker, not an unversioned/CDN URL");
});

test("the dev proxy preserves cookies, login parameters, Origin rewriting and POST logout", async () => {
  const upstream = createHttpServer(async (request, response) => {
    let body = "";
    for await (const part of request) body += part;
    response.setHeader("Content-Type", "application/json");
    response.setHeader("Set-Cookie", "session=fixture; Path=/; HttpOnly; SameSite=Lax");
    response.end(JSON.stringify({
      url: request.url, method: request.method, origin: request.headers.origin,
      cookie: request.headers.cookie, body,
    }));
  });
  upstream.listen(0, "127.0.0.1");
  await once(upstream, "listening");
  const target = `http://127.0.0.1:${upstream.address().port}`;
  const previousOrigin = process.env.TEMPVS_DEV_ORIGIN;
  process.env.TEMPVS_DEV_ORIGIN = target;
  let server;
  try {
    server = await createServer({
      configFile: "vite.config.mts",
      server: { host: "127.0.0.1", port: 0, strictPort: false },
    });
    await server.listen();
    const local = `http://127.0.0.1:${server.httpServer.address().port}`;
    const headers = { Origin: local, Cookie: "session=fixture" };
    const api = await fetch(`${local}/api/probe?x=1`, { headers });
    assert.deepEqual(await api.json(), {
      url: "/api/probe?x=1", method: "GET", origin: target,
      cookie: "session=fixture", body: "",
    });
    assert.match(api.headers.get("set-cookie"), /session=fixture/);

    const login = await fetch(`${local}/auth/login?provider=Google&returnTo=%2Fmap`, { headers });
    const url = new URL((await login.json()).url, target);
    assert.equal(url.pathname, "/auth/login");
    assert.equal(url.searchParams.get("provider"), "Google");
    assert.equal(url.searchParams.get("returnTo"), "/map");
    assert.equal(url.searchParams.get("local"), "1");

    const logout = await fetch(`${local}/auth/logout`, {
      method: "POST", headers, body: "reason=fixture",
    });
    assert.deepEqual(await logout.json(), {
      url: "/auth/logout", method: "POST", origin: target,
      cookie: "session=fixture", body: "reason=fixture",
    });
  } finally {
    if (server) await server.close();
    await new Promise((resolve) => upstream.close(resolve));
    if (previousOrigin === undefined) delete process.env.TEMPVS_DEV_ORIGIN;
    else process.env.TEMPVS_DEV_ORIGIN = previousOrigin;
  }
});
