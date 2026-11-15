export {};

let session: typeof import("./session");

function response(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  } as Response;
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
beforeEach(() => {
  jest.resetModules();
  session = require("./session");
});
afterEach(() => jest.restoreAllMocks());

test("the navbar and page viewer share one identity request and cache", async () => {
  const transport = jest
    .spyOn(window, "fetch")
    .mockResolvedValue(
      response({
        userId: "member",
        name: "Ada",
        picture: "/google.jpg",
        roles: ["MAP_EDITOR"],
      }),
    );
  const { getViewer } = require("./viewerApi") as typeof import("./viewerApi");
  const { fetchCurrentUserInfo } =
    require("../profile/profileApi") as typeof import("../profile/profileApi");
  const header = new Promise<any>((resolve) => fetchCurrentUserInfo(resolve));
  const [identity, viewer] = await Promise.all([header, getViewer()]);
  expect(identity).toMatchObject({
    currentUserId: "member",
    oauthProfile: { picture: "/google.jpg" },
  });
  expect(viewer).toEqual({ userId: "member", roles: ["MAP_EDITOR"] });
  expect(transport).toHaveBeenCalledTimes(1);
});

test("an explicit role refresh is not satisfied by an older in-flight identity read", async () => {
  const initial = deferred<Response>();
  const transport = jest.spyOn(window, "fetch").mockReturnValueOnce(initial.promise)
    .mockResolvedValue(response({ userId: "member", roles: ["MAP_ADMIN"] }));
  const ordinary = session.getSession();
  const refreshed = session.getSession({ refreshRoles: true });
  initial.resolve(response({ userId: "member", roles: [] }));
  await ordinary;
  expect(await refreshed).toMatchObject({ roles: ["MAP_ADMIN"] });
  expect(transport.mock.calls.map(([url]) => url)).toEqual(["/api/user/me", "/api/user/me?refresh=roles"]);
  expect(await session.getSession()).toMatchObject({ roles: ["MAP_ADMIN"] });
});

test("confirmed logout invalidates the cached identity for every reader", async () => {
  jest
    .spyOn(window, "fetch")
    .mockResolvedValueOnce(response({ userId: "member" }))
    .mockResolvedValue(response({}, 401));
  await session.getSession();
  const changed = jest.fn();
  const stop = session.subscribeSession(changed);
  expect(await session.getSession({ force: true })).toBeNull();
  expect(changed).toHaveBeenCalledWith(null);
  expect(await session.getSession()).toBeNull();
  stop();
});

test("an API 401 rechecks the session and publishes logout without consuming the failed response", async () => {
  const failed = response({ message: "Sign in" }, 401);
  jest
    .spyOn(window, "fetch")
    .mockResolvedValueOnce(response({ userId: "member" }))
    .mockResolvedValueOnce(failed)
    .mockResolvedValue(response({}, 401));
  await session.getSession();
  const changed = jest.fn();
  const stop = session.subscribeSession(changed);
  const restore = session.observeSessionResponses();
  try {
    const result = await fetch("/api/wall?profileId=p");
    await session.getSession({ force: true });
    expect(changed).toHaveBeenCalledWith(null);
    expect(result).toBe(failed);
    expect(JSON.parse(await result.text())).toEqual({ message: "Sign in" });
  } finally {
    restore();
    stop();
  }
});

test("service 401 does not sign out a session that the identity endpoint confirms is active", async () => {
  const transport = jest
    .spyOn(window, "fetch")
    .mockResolvedValue(response({ userId: "member" }));
  await session.getSession();
  const changed = jest.fn();
  const stop = session.subscribeSession(changed);
  const restore = session.observeSessionResponses();
  try {
    transport.mockResolvedValueOnce(response({}, 401));
    await fetch("/api/wall");
    expect(await session.getSession({ force: true })).toMatchObject({
      userId: "member",
    });
    expect(changed).not.toHaveBeenCalledWith(null);
  } finally {
    restore();
    stop();
  }
});

test("permission failures, login errors, and third-party 401s do not end the app session", async () => {
  const transport = jest
    .spyOn(window, "fetch")
    .mockResolvedValueOnce(response({ userId: "member" }))
    .mockResolvedValueOnce(response({}, 403))
    .mockResolvedValue(response({}, 401));
  await session.getSession();
  const changed = jest.fn();
  const stop = session.subscribeSession(changed);
  const restore = session.observeSessionResponses();
  try {
    await fetch("/api/map/admin/roles");
    await fetch("/auth/password-login");
    await fetch("https://third-party.test/api/user/me");
    expect(changed).not.toHaveBeenCalled();
    expect(transport).toHaveBeenCalledTimes(4);
  } finally {
    restore();
    stop();
  }
});

test("network and server failures do not publish a logout", async () => {
  const transport = jest
    .spyOn(window, "fetch")
    .mockResolvedValue(response({ userId: "member" }));
  await session.getSession();
  const changed = jest.fn();
  const stop = session.subscribeSession(changed);
  transport.mockRejectedValueOnce(new Error("Offline"));
  await expect(session.getSession({ force: true })).rejects.toThrow("Offline");
  transport.mockResolvedValueOnce(response({}, 503));
  await expect(session.getSession({ force: true })).rejects.toThrow("503");
  expect(changed).not.toHaveBeenCalledWith(null);
  stop();
});

test("a late successful session response cannot restore a logged-out account", async () => {
  const old = deferred<Response>();
  jest.spyOn(window, "fetch").mockReturnValue(old.promise);
  const request = session.getSession();
  session.endSession(false);
  old.resolve(response({ userId: "obsolete" }));
  expect(await request).toBeNull();
});

test("a late 401 from an older session cannot remove a newer verified account", async () => {
  const old = deferred<Response>();
  const transport = jest
    .spyOn(window, "fetch")
    .mockResolvedValueOnce(response({ userId: "old" }))
    .mockReturnValueOnce(old.promise);
  await session.getSession();
  const restore = session.observeSessionResponses();
  try {
    const request = fetch("/api/wall");
    transport.mockResolvedValue(response({ userId: "new" }));
    await session.getSession({ force: true });
    old.resolve(response({}, 401));
    await request;
    expect(await session.getSession()).toMatchObject({ userId: "new" });
  } finally {
    restore();
  }
});
