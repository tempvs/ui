import type { SourceChangeset } from "../libraryApi";

export const topics = [
  "browse",
  "source",
  "workflow",
  "proposal",
  "status",
  "review",
  "tasks",
  "publish",
  "members",
  "overrides",
] as const;
export type LibraryTopic = (typeof topics)[number];
export type LibraryAudience =
  "reader" | "contributor" | "archivarius" | "admin";
export type LearningProgress = {
  learned: LibraryTopic[];
  dismissedHints: LibraryTopic[];
  hiddenAudiences: LibraryAudience[];
};
type Update = {
  learned?: LibraryTopic[];
  dismissedHints?: LibraryTopic[];
  audience?: LibraryAudience;
  hidden?: boolean;
};
type Entry = {
  progress: LearningProgress;
  ready: boolean;
  read?: Promise<void>;
  pending: LibraryTopic[];
  dismissed: LibraryTopic[];
  visibility: Partial<Record<LibraryAudience, boolean>>;
  timer?: ReturnType<typeof setTimeout>;
  writing?: Promise<void>;
};
const entries = new Map<string, Entry>();
const listeners = new Set<() => void>();
const endpoint = "/api/library/library/onboarding";
let activeUser: string | null = null;
export function setLibraryLearningUser(id: string | null) {
  activeUser = id;
}
export function libraryLearningUser() {
  return activeUser;
}
const storageKey = (id: string) => `tempvs:library-learning:1:${id}`;
const audiences: LibraryAudience[] = [
  "reader",
  "contributor",
  "archivarius",
  "admin",
];
const unique = <T>(values: T[]): T[] => Array.from(new Set(values));

function decode(value: any): LearningProgress {
  return {
    learned: topics.filter(
      (topic) => Array.isArray(value?.learned) && value.learned.includes(topic),
    ),
    dismissedHints: topics.filter(
      (topic) =>
        Array.isArray(value?.dismissedHints) &&
        value.dismissedHints.includes(topic),
    ),
    hiddenAudiences: audiences.filter(
      (audience) =>
        Array.isArray(value?.hiddenAudiences) &&
        value.hiddenAudiences.includes(audience),
    ),
  };
}
function entry(id: string): Entry {
  const existing = entries.get(id);
  if (existing) return existing;
  let value: any;
  try {
    value = JSON.parse(localStorage.getItem(storageKey(id)) || "null");
  } catch {
    /* Storage is optional. */
  }
  const next: Entry = {
    progress: decode(value?.progress),
    ready: false,
    pending: decode({ learned: value?.pending }).learned,
    dismissed: decode({ dismissedHints: value?.dismissed }).dismissedHints,
    visibility: {},
  };
  for (const audience of audiences)
    if (typeof value?.visibility?.[audience] === "boolean")
      next.visibility[audience] = value.visibility[audience];
  entries.set(id, next);
  return next;
}
function emit(id: string) {
  const current = entry(id);
  try {
    localStorage.setItem(
      storageKey(id),
      JSON.stringify({
        progress: current.progress,
        pending: current.pending,
        dismissed: current.dismissed,
        visibility: current.visibility,
      }),
    );
  } catch {
    /* Still works in memory. */
  }
  listeners.forEach((listener) => listener());
}
export function subscribeLibraryLearning(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function libraryLearningSnapshot(id: string) {
  return entry(id);
}

export function receiveLibraryLearningStorage(event: StorageEvent) {
  if (!activeUser || event.key !== storageKey(activeUser) || !event.newValue)
    return;
  try {
    const value = JSON.parse(event.newValue);
    const disk = decode(value.progress);
    const current = entry(activeUser);
    current.progress = {
      learned: unique([...current.progress.learned, ...disk.learned]),
      dismissedHints: unique([
        ...current.progress.dismissedHints,
        ...disk.dismissedHints,
      ]),
      hiddenAudiences: disk.hiddenAudiences,
    };
    for (const audience of audiences) {
      if (current.visibility[audience] === true)
        current.progress.hiddenAudiences = unique([
          ...current.progress.hiddenAudiences,
          audience,
        ]);
      if (current.visibility[audience] === false)
        current.progress.hiddenAudiences =
          current.progress.hiddenAudiences.filter((item) => item !== audience);
    }
    listeners.forEach((listener) => listener());
  } catch {
    /* Ignore malformed optional browser storage. */
  }
}

/** One small account-keyed read per app session. Never poll or scan source history. */
export function loadLibraryLearning(id: string): Promise<void> {
  const current = entry(id);
  if (current.read) {
    schedule(id);
    return current.read;
  }
  current.read = (async () => {
    try {
      const response = await fetch(endpoint);
      if (!response.ok)
        throw new Error("Unable to read Library learning preferences");
      const server = decode(await response.json());
      current.progress = {
        learned: unique([...server.learned, ...current.progress.learned]),
        dismissedHints: unique([
          ...server.dismissedHints,
          ...current.progress.dismissedHints,
        ]),
        hiddenAudiences: server.hiddenAudiences,
      };
      for (const audience of audiences) {
        if (current.visibility[audience] === true)
          current.progress.hiddenAudiences = unique([
            ...current.progress.hiddenAudiences,
            audience,
          ]);
        if (current.visibility[audience] === false)
          current.progress.hiddenAudiences =
            current.progress.hiddenAudiences.filter(
              (item) => item !== audience,
            );
      }
      current.ready = true;
      emit(id);
      schedule(id);
    } catch {
      // Do not show potentially stale hints when account progress cannot be read.
      current.ready = false;
      current.read = undefined;
      listeners.forEach((listener) => listener());
    }
  })();
  return current.read;
}
function schedule(id: string) {
  const current = entry(id);
  if (current.timer || current.writing) return;
  if (
    !current.pending.length &&
    !current.dismissed.length &&
    !Object.keys(current.visibility).length
  )
    return;
  current.timer = setTimeout(() => {
    current.timer = undefined;
    void flushLibraryLearning(id);
  }, 500);
}
export function updateLibraryLearning(id: string, update: Update) {
  const current = entry(id);
  const learned = (update.learned || []).filter(
    (topic) => !current.progress.learned.includes(topic),
  );
  const dismissed = (update.dismissedHints || []).filter(
    (topic) => !current.progress.dismissedHints.includes(topic),
  );
  const visibilityChanged =
    update.audience &&
    current.progress.hiddenAudiences.includes(update.audience) !==
      update.hidden;
  if (!learned.length && !dismissed.length && !visibilityChanged) {
    schedule(id);
    return;
  }
  current.progress = {
    ...current.progress,
    learned: unique([...current.progress.learned, ...learned]),
    dismissedHints: unique([...current.progress.dismissedHints, ...dismissed]),
  };
  current.pending = unique([...current.pending, ...learned]);
  current.dismissed = unique([...current.dismissed, ...dismissed]);
  if (update.audience && visibilityChanged) {
    current.visibility[update.audience] = Boolean(update.hidden);
    current.progress.hiddenAudiences = update.hidden
      ? unique([...current.progress.hiddenAudiences, update.audience])
      : current.progress.hiddenAudiences.filter(
          (audience) => audience !== update.audience,
        );
  }
  emit(id);
  schedule(id);
}
export async function flushLibraryLearning(id: string): Promise<void> {
  const current = entry(id);
  if (current.writing) return current.writing;
  if (
    !current.pending.length &&
    !current.dismissed.length &&
    !Object.keys(current.visibility).length
  )
    return;
  const learned = current.pending.slice();
  const dismissedHints = current.dismissed.slice();
  const audience = audiences.find(
    (item) => current.visibility[item] !== undefined,
  );
  const hidden = audience ? current.visibility[audience] : undefined;
  let success = false;
  current.writing = (async () => {
    try {
      const response = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(learned.length ? { learned } : {}),
          ...(dismissedHints.length ? { dismissedHints } : {}),
          ...(audience ? { audience, hidden } : {}),
        }),
      });
      if (!response.ok) return;
      const server = decode(await response.json());
      current.pending = current.pending.filter(
        (topic) => !learned.includes(topic),
      );
      current.dismissed = current.dismissed.filter(
        (topic) => !dismissedHints.includes(topic),
      );
      if (audience && current.visibility[audience] === hidden)
        delete current.visibility[audience];
      current.progress = {
        ...current.progress,
        learned: unique([...server.learned, ...current.progress.learned]),
        dismissedHints: unique([
          ...server.dismissedHints,
          ...current.progress.dismissedHints,
        ]),
      };
      success = true;
      emit(id);
    } catch {
      /* Keep queued changes on disk; retry on the next interaction or Library visit. */
    }
  })();
  await current.writing;
  current.writing = undefined;
  if (success) schedule(id);
}

/** Existing proposals teach us about prior experience without any extra query. */
export function learnFromChangeset(id: string, changeset: SourceChangeset) {
  const learned: LibraryTopic[] = ["source", "status"];
  if (
    changeset.proposerId === id ||
    changeset.amendments?.some((item) => item.userId === id)
  )
    learned.push("browse", "workflow", "proposal");
  if (
    changeset.approvals?.some((item) => item.userId === id) ||
    changeset.reviewerId === id
  )
    learned.push("workflow", "review");
  if (
    changeset.tasks?.some(
      (task) =>
        task.createdBy === id ||
        task.resolvedBy === id ||
        task.reopenedBy === id,
    )
  )
    learned.push("tasks");
  if (
    changeset.publishedBy === id ||
    (changeset.status === "APPLIED" && changeset.proposerId === id)
  )
    learned.push("workflow", "proposal", "publish");
  updateLibraryLearning(id, { learned });
}

export function observeLibraryResponse(
  id: string | null,
  url: string,
  method: string,
  data: any,
) {
  try {
    observeResponse(id, url, method, data);
  } catch {
    // Optional learning evidence must never turn a committed source action into a failure.
  }
}

function observeResponse(
  id: string | null,
  url: string,
  method: string,
  data: any,
) {
  if (!id || id !== activeUser || !data) return;
  if (url.includes("/changesets")) {
    const rows = Array.isArray(data.content)
      ? data.content
      : [data.changeset || data];
    rows.forEach((row: any) => {
      const changeset = row.changeset || row;
      if (changeset.id && changeset.proposerId && changeset.status)
        learnFromChangeset(id, changeset);
    });
  }
  const learned: LibraryTopic[] = [];
  if (
    url.includes("/library/admin/role-history") &&
    data.entries?.some((item: any) => item.actorUserId === id)
  )
    learned.push("members");
  if (method === "GET" && /\/source\/find\?/.test(url)) learned.push("browse");
  if (method === "GET" && /\/source\/[^/?]+$/.test(url)) learned.push("source");
  if (method !== "GET") {
    if (url.endsWith("/source") || /\/changesets(?:\/[^/?]+)?$/.test(url))
      learned.push("proposal", "workflow");
    if (/\/tasks(?:\/[^/?]+)?$/.test(url)) learned.push("tasks");
    if (/\/(approve|reject)$/.test(url)) learned.push("review", "workflow");
    if (url.endsWith("/publish")) learned.push("publish", "workflow");
    if (url.endsWith("/approve-override")) learned.push("overrides");
    if (
      /\/library\/(?:admin\/users\/[^/]+\/role|LIBRARY_[^/]+\/[^/]+)$/.test(url)
    )
      learned.push("members");
  }
  if (learned.length) updateLibraryLearning(id, { learned });
}
