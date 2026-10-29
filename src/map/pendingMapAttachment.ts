import type { PublicMapReference } from "./MapReferenceAttachment";

const key = "tempvs.pending-map-attachment";
const authorKey = "tempvs.pending-map-author-profile";
const targetKey = "tempvs.pending-map-target";

export function stageMapAttachment(
  reference: PublicMapReference,
  authorProfileId?: string,
  target?: { type: string; id: string },
) {
  window.sessionStorage.setItem(key, JSON.stringify(reference));
  if (authorProfileId) window.sessionStorage.setItem(authorKey, authorProfileId);
  else window.sessionStorage.removeItem(authorKey);
  if (target) window.sessionStorage.setItem(targetKey, `${target.type}:${target.id}`);
  else window.sessionStorage.removeItem(targetKey);
}

export function takeStagedMapAuthorProfile(): string | null {
  const value = window.sessionStorage.getItem(authorKey);
  window.sessionStorage.removeItem(authorKey);
  return value?.trim() || null;
}

export function takeStagedMapAttachment(): PublicMapReference | null {
  return take();
}

export function takeStagedMapAttachmentForTarget(
  target: { type: string; id: string },
): PublicMapReference | null {
  if (window.sessionStorage.getItem(targetKey) !== `${target.type}:${target.id}`)
    return null;
  window.sessionStorage.removeItem(targetKey);
  return take();
}

function take(): PublicMapReference | null {
  const raw = window.sessionStorage.getItem(key);
  window.sessionStorage.removeItem(key);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<PublicMapReference>;
    return typeof value.latitude === "number" && typeof value.longitude === "number" && typeof value.radiusKm === "number" && Array.isArray(value.entityTypes) ? value as PublicMapReference : null;
  } catch { return null; }
}
