import type { SourceChangeset } from "../libraryApi";

let learning: typeof import("./libraryLearning");
const progress = { learned: [], dismissedHints: [], hiddenAudiences: [] };
beforeEach(() => {
  jest.resetModules();
  jest.useFakeTimers();
  localStorage.clear();
  learning = require("./libraryLearning");
  global.fetch = jest
    .fn()
    .mockResolvedValue({ ok: true, json: async () => progress });
});
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

test("one keyed read per account per session; repeated completed actions cause no more writes", async () => {
  await Promise.all([
    learning.loadLibraryLearning("member"),
    learning.loadLibraryLearning("member"),
  ]);
  await learning.loadLibraryLearning("member");
  expect(fetch).toHaveBeenCalledTimes(1);
  learning.updateLibraryLearning("member", { learned: ["proposal"] });
  learning.updateLibraryLearning("member", { learned: ["proposal", "tasks"] });
  await learning.flushLibraryLearning("member");
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(JSON.parse((fetch as jest.Mock).mock.calls[1][1].body)).toEqual({
    learned: ["proposal", "tasks"],
  });
  learning.updateLibraryLearning("member", { learned: ["proposal", "tasks"] });
  await learning.flushLibraryLearning("member");
  expect(fetch).toHaveBeenCalledTimes(2);
});

test("a delayed read cannot erase an action learned while it was in flight", async () => {
  let finish!: (value: unknown) => void;
  (fetch as jest.Mock).mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const read = learning.loadLibraryLearning("member");
  learning.updateLibraryLearning("member", { learned: ["publish"] });
  finish({ ok: true, json: async () => progress });
  await read;
  expect(learning.libraryLearningSnapshot("member").progress.learned).toContain(
    "publish",
  );
});

test("failed writes survive a reload and are replayed without losing completion", async () => {
  await learning.loadLibraryLearning("member");
  (fetch as jest.Mock).mockResolvedValueOnce({ ok: false });
  learning.updateLibraryLearning("member", { learned: ["tasks"] });
  await learning.flushLibraryLearning("member");
  expect(fetch).toHaveBeenCalledTimes(2);
  jest.resetModules();
  learning = require("./libraryLearning");
  await learning.loadLibraryLearning("member");
  expect(learning.libraryLearningSnapshot("member").progress.learned).toContain(
    "tasks",
  );
  expect(learning.libraryLearningSnapshot("member").pending).toContain("tasks");
  await learning.flushLibraryLearning("member");
  expect(learning.libraryLearningSnapshot("member").pending).toEqual([]);
  expect(
    JSON.parse(
      (fetch as jest.Mock).mock.calls
        .filter((call) => call[1]?.method === "PATCH")
        .slice(-1)[0][1].body,
    ),
  ).toEqual({ learned: ["tasks"] });
});

test("progress and visibility are isolated by account and role journey", async () => {
  learning.updateLibraryLearning("experienced", {
    learned: ["browse"],
    audience: "reader",
    hidden: true,
  });
  expect(learning.libraryLearningSnapshot("new-user").progress.learned).toEqual(
    [],
  );
  const current = learning.libraryLearningSnapshot("experienced");
  expect(current.progress.hiddenAudiences).toEqual(["reader"]);
  expect(current.progress.hiddenAudiences).not.toContain("contributor");
});

test("old proposal evidence suppresses experienced topics without querying history", () => {
  learning.learnFromChangeset("member", {
    id: "proposal-1",
    proposerId: "member",
    status: "APPLIED",
    tasks: [{ createdBy: "member" }],
  } as SourceChangeset);
  expect(learning.libraryLearningSnapshot("member").progress.learned).toEqual(
    expect.arrayContaining([
      "browse",
      "source",
      "workflow",
      "proposal",
      "status",
      "publish",
      "tasks",
    ]),
  );
  expect(
    learning.libraryLearningSnapshot("member").progress.learned,
  ).not.toContain("review");
  expect(fetch).not.toHaveBeenCalled();
});

test("storage events suppress hints learned in another tab without a request", () => {
  learning.setLibraryLearningUser("member");
  learning.receiveLibraryLearningStorage(
    new StorageEvent("storage", {
      key: "tempvs:library-learning:1:member",
      newValue: JSON.stringify({
        progress: {
          ...progress,
          learned: ["review"],
          dismissedHints: ["tasks"],
        },
      }),
    }),
  );
  expect(learning.libraryLearningSnapshot("member").progress.learned).toContain(
    "review",
  );
  expect(
    learning.libraryLearningSnapshot("member").progress.dismissedHints,
  ).toContain("tasks");
  expect(fetch).not.toHaveBeenCalled();
});

test("unavailable progress never enables automatic hints", async () => {
  (fetch as jest.Mock).mockRejectedValueOnce(new Error("offline"));
  await learning.loadLibraryLearning("member");
  expect(learning.libraryLearningSnapshot("member").ready).toBe(false);
});
