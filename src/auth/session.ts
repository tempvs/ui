export type Session = {
  userId: string;
  roles: string[];
  name?: string | null;
  email?: string | null;
  picture?: string | null;
};

type ReadOptions = { force?: boolean; refreshRoles?: boolean };
type Listener = (session: Session | null) => void;
export const SESSION_ENDED_STORAGE_KEY = "tempvs:session-ended";
const listeners = new Set<Listener>();
let snapshot: Session | null | undefined;
let expiresAt = 0;
let revision = 0;
let pending:
  | { request: Promise<Session | null>; refreshRoles: boolean }
  | undefined;

export function subscribeSession(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function invalidateSessionCache(): void {
  revision++;
  pending = undefined;
  expiresAt = 0;
}

/** The value contains no account data or credentials; storage notifies other tabs. */
export function broadcastLogout(): void {
  try {
    window.localStorage.setItem(
      SESSION_ENDED_STORAGE_KEY,
      `${Date.now()}:${Math.random()}`,
    );
  } catch {
    // Same-tab session detection still works with browser storage disabled.
  }
}

export function endSession(broadcast = true): void {
  const wasSignedIn = Boolean(snapshot);
  revision++;
  snapshot = null;
  expiresAt = 0;
  pending = undefined;
  listeners.forEach((listener) => listener(null));
  if (broadcast && wasSignedIn) broadcastLogout();
}

/** One authoritative identity read for the navbar and every page API. */
export function getSession(options: ReadOptions = {}): Promise<Session | null> {
  if (pending) {
    if (options.refreshRoles && !pending.refreshRoles)
      return pending.request.then(() =>
        getSession({ ...options, force: true }),
      );
    return pending.request;
  }
  if (
    !options.force &&
    !options.refreshRoles &&
    snapshot !== undefined &&
    expiresAt > Date.now()
  )
    return Promise.resolve(snapshot);
  const startedAtRevision = revision;
  const request = readSession(options)
    .then((value) => {
      // A response started before a confirmed logout cannot restore its avatar.
      if (startedAtRevision !== revision) return snapshot ?? null;
      if (!value) {
        endSession();
        return null;
      }
      const changed = JSON.stringify(snapshot) !== JSON.stringify(value);
      snapshot = value;
      revision++;
      expiresAt = Date.now() + 60_000;
      if (changed) listeners.forEach((listener) => listener(value));
      return value;
    })
    .finally(() => {
      if (pending?.request === request) pending = undefined;
    });
  pending = { request, refreshRoles: Boolean(options.refreshRoles) };
  return request;
}

async function readSession(options: ReadOptions): Promise<Session | null> {
  const response = await fetch(
    options.refreshRoles ? "/api/user/me?refresh=roles" : "/api/user/me",
    { cache: "no-store" },
  );
  if (response.status === 401) return null;
  if (!response.ok)
    throw new Error(`Session check failed (${response.status})`);
  const text = await response.text();
  const data = (text ? JSON.parse(text) : null) as Record<
    string,
    unknown
  > | null;
  if (!data || typeof data.userId !== "string" || !data.userId) return null;
  return {
    userId: data.userId,
    roles: Array.isArray(data.roles)
      ? data.roles.filter((role): role is string => typeof role === "string")
      : [],
    ...(typeof data.name === "string" ? { name: data.name } : {}),
    ...(typeof data.email === "string" ? { email: data.email } : {}),
    ...(typeof data.picture === "string" ? { picture: data.picture } : {}),
  };
}

let observationCount = 0;
let observedFetch: typeof fetch | undefined;
let originalFetch: typeof fetch | undefined;

/** Observe authentication failures without consuming bodies or changing responses. */
export function observeSessionResponses(): () => void {
  if (observationCount++ === 0) {
    originalFetch = window.fetch;
    const transport = originalFetch;
    observedFetch = async (input, init) => {
      const startedAtRevision = revision;
      const response = await transport.call(window, input, init);
      const url = new URL(
        typeof input === "string"
          ? input
          : input instanceof URL
          ? input.href
          : input.url,
        window.location.href,
      );
      if (
        response.status === 401 &&
        url.origin === window.location.origin &&
        url.pathname.startsWith("/api/") &&
        startedAtRevision === revision
      ) {
        if (url.pathname === "/api/user/me") endSession();
        else if (snapshot) {
          // A service permission failure must not impersonate a logout. Verify
          // the session endpoint; all simultaneous failures share this read.
          void getSession({ force: true }).catch(() => undefined);
        }
      }
      return response;
    };
    window.fetch = observedFetch;
  }
  return () => {
    if (--observationCount === 0) {
      if (window.fetch === observedFetch && originalFetch)
        window.fetch = originalFetch;
      observedFetch = undefined;
      originalFetch = undefined;
    }
  };
}
