import type { PublicMapReference } from "./MapReferenceAttachment";

const key = "tempvs.pending-map-attachment";
const authorKey = "tempvs.pending-map-author-profile";

export function stageMapAttachment(
  reference: PublicMapReference,
  authorProfileId?: string,
) {
  window.sessionStorage.setItem(key, JSON.stringify(reference));
  if (authorProfileId) window.sessionStorage.setItem(authorKey, authorProfileId);
  else window.sessionStorage.removeItem(authorKey);
}

export function takeStagedMapAuthorProfile(): string | null {
  const value = window.sessionStorage.getItem(authorKey);
  window.sessionStorage.removeItem(authorKey);
  return value?.trim() || null;
}

export function takeStagedMapAttachment(): PublicMapReference | null {
  const raw = window.sessionStorage.getItem(key);
  window.sessionStorage.removeItem(key);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<PublicMapReference>;
    return typeof value.latitude === "number" && typeof value.longitude === "number" && typeof value.radiusKm === "number" && Array.isArray(value.entityTypes) ? value as PublicMapReference : null;
  } catch { return null; }
}
