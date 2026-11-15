type Entry<T> = {
  controller: AbortController;
  request: Promise<T>;
  settled: boolean;
  expiresAt: number;
  consumers: number;
  latest?: T;
  listeners: Set<(value: T) => void>;
};

/** Short-lived shared reads with independent subscribers. Abandoning one
 * consumer cannot cancel another; abandoning the last cancels the transport. */
export class SharedReadCache<T> {
  private entries = new Map<string, Entry<T>>();
  constructor(
    private ttlMs: number,
    private capacity: number,
  ) {}

  read(
    key: string,
    load: (signal: AbortSignal, publish: (value: T) => void) => Promise<T>,
    signal?: AbortSignal,
    onProgress?: (value: T) => void,
  ): Promise<T> {
    if (signal?.aborted) return Promise.reject(signal.reason);
    for (const [id, value] of this.entries)
      if (value.settled && value.expiresAt <= Date.now())
        this.entries.delete(id);
    let entry = this.entries.get(key);
    if (!entry) {
      const controller = new AbortController();
      const created: Entry<T> = {
        controller,
        request: undefined as unknown as Promise<T>,
        settled: false,
        expiresAt: Infinity,
        consumers: 0,
        listeners: new Set(),
      };
      this.entries.set(key, created);
      created.request = Promise.resolve()
        .then(() => {
          controller.signal.throwIfAborted();
          return load(controller.signal, (value) => {
            if (controller.signal.aborted) return;
            created.latest = value;
            created.listeners.forEach((listener) => listener(value));
          });
        })
        .then(
          (value) => {
            created.settled = true;
            created.expiresAt = Date.now() + this.ttlMs;
            this.trim();
            return value;
          },
          (error: unknown) => {
            created.settled = true;
            if (this.entries.get(key) === created) this.entries.delete(key);
            throw error;
          },
        );
      entry = created;
    }
    // Refresh insertion order for LRU eviction of completed results.
    this.entries.delete(key);
    this.entries.set(key, entry);
    const current = entry;
    current.consumers++;
    if (onProgress) {
      current.listeners.add(onProgress);
      if (current.latest !== undefined) onProgress(current.latest);
    }
    return new Promise<T>((resolve, reject) => {
      let done = false;
      const finish = (action: () => void) => {
        if (done) return;
        done = true;
        signal?.removeEventListener("abort", abort);
        if (onProgress) current.listeners.delete(onProgress);
        current.consumers--;
        action();
        if (!current.consumers && !current.settled) {
          if (this.entries.get(key) === current) this.entries.delete(key);
          current.controller.abort();
        }
      };
      const abort = () => finish(() => reject(signal?.reason));
      signal?.addEventListener("abort", abort, { once: true });
      current.request.then(
        (value) => finish(() => resolve(value)),
        (error: unknown) => finish(() => reject(error)),
      );
    });
  }

  private trim() {
    let completed = [...this.entries.values()].filter(
      (entry) => entry.settled,
    ).length;
    for (const [key, entry] of this.entries) {
      if (completed <= this.capacity) break;
      if (entry.settled) {
        this.entries.delete(key);
        completed--;
      }
    }
  }
}
