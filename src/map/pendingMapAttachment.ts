import type { PublicMapReference } from "./MapReferenceAttachment";

const key = "tempvs.pending-map-attachment";

export function stageMapAttachment(reference: PublicMapReference) {
  window.sessionStorage.setItem(key, JSON.stringify(reference));
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
