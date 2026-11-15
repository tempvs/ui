import { SharedReadCache } from "./sharedRead";

test("canceling one shared consumer preserves the other; the last cancellation aborts transport", async () => {
  const cache = new SharedReadCache<number>(1000, 2);
  let transport!: AbortSignal;
  let finish!: (value: number) => void;
  const load = jest.fn((signal: AbortSignal) => {
    transport = signal;
    return new Promise<number>((resolve, reject) => {
      finish = resolve;
      signal.addEventListener("abort", () => reject(signal.reason));
    });
  });
  const first = new AbortController(),
    second = new AbortController();
  const a = cache.read("shared", load, first.signal);
  const aError = expect(a).rejects.toMatchObject({ name: "AbortError" });
  const b = cache.read("shared", load, second.signal);
  await Promise.resolve();
  first.abort();
  await aError;
  expect(transport.aborted).toBe(false);
  finish(42);
  await expect(b).resolves.toBe(42);
  expect(load).toHaveBeenCalledTimes(1);
  const third = new AbortController();
  const c = cache.read("abandoned", load, third.signal);
  const cError = expect(c).rejects.toMatchObject({ name: "AbortError" });
  await Promise.resolve();
  third.abort();
  await cError;
  expect(transport.aborted).toBe(true);
  await expect(cache.read("abandoned", async () => 7)).resolves.toBe(7);
});

test("replays progress to new subscribers and bounds completed cached reads", async () => {
  const cache = new SharedReadCache<number>(1000, 2);
  let finish!: (value: number) => void;
  const firstProgress = jest.fn(),
    secondProgress = jest.fn();
  const load = jest.fn(
    async (_signal: AbortSignal, publish: (value: number) => void) => {
      publish(1);
      return new Promise<number>((resolve) => {
        finish = resolve;
      });
    },
  );
  const a = cache.read("a", load, undefined, firstProgress);
  await Promise.resolve();
  const b = cache.read("a", load, undefined, secondProgress);
  expect(secondProgress).toHaveBeenCalledWith(1);
  finish(2);
  await Promise.all([a, b]);
  const next = jest.fn(async () => 3);
  await cache.read("b", next);
  await cache.read("c", next);
  await cache.read("a", next);
  expect(next).toHaveBeenCalledTimes(3);
});

test("expires completed reads and retries rejected reads", async () => {
  const cache = new SharedReadCache<number>(10, 2);
  const clock = jest.spyOn(Date, "now").mockReturnValue(100);
  try {
    const load = jest.fn(async () => 1);
    await cache.read("a", load);
    await cache.read("a", load);
    expect(load).toHaveBeenCalledTimes(1);
    clock.mockReturnValue(111);
    await cache.read("a", load);
    expect(load).toHaveBeenCalledTimes(2);
    await expect(
      cache.read("failed", async () => {
        throw new Error("failed");
      }),
    ).rejects.toThrow("failed");
    await expect(cache.read("failed", load)).resolves.toBe(1);
  } finally {
    clock.mockRestore();
  }
});
