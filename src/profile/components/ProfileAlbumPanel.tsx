import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Form } from "react-bootstrap";

import StackedImageGallery, { type GalleryImage } from "../../component/StackedImageGallery";

type Image = { id: string; url?: string; thumbnailUrl?: string; description?: string | null; status?: string; fileName?: string };

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/profile${path}`, { ...options, headers: { "content-type": "application/json", ...(options.headers || {}) } });
  const body = await response.json().catch(() => undefined) as { message?: string } | undefined;
  if (!response.ok) throw new Error(body?.message || "Unable to update profile images.");
  return body as T;
}
async function images(profileId: string | number) {
  const response = await fetch(`/api/images/profile/${encodeURIComponent(String(profileId))}?limit=100`);
  if (!response.ok) throw new Error("Unable to load profile images.");
  return ((await response.json()) as { content?: Image[] }).content || [];
}

export default function ProfileAlbumPanel({ profileId, title, editable }: { profileId: string | number; title: string; editable: boolean }) {
  const [value, setValue] = useState<Image[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [replacement, setReplacement] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const reload = useCallback(() => images(profileId).then(found => { setValue(found); setDrafts(Object.fromEntries(found.map(item => [item.id, item.description || ""]))); }), [profileId]);
  useEffect(() => { void reload().catch(() => undefined); }, [reload]);
  const openPicker = (imageId?: string) => { setReplacement(imageId); input.current?.click(); };
  const upload = async (event: React.ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; event.target.value = ""; if (!file) return; if (!["image/jpeg", "image/png", "image/gif"].includes(file.type) || file.size > 20 * 1024 * 1024) { setError("Choose a JPEG, PNG, or GIF image up to 20 MB."); return; } setBusy(true); setError(""); try { const intent = await request<{ image: Image; upload: { method: string; url: string; headers: Record<string, string> } }>(`/profile/${encodeURIComponent(String(profileId))}/images${replacement ? `/${encodeURIComponent(replacement)}` : ""}`, { method: replacement ? "PATCH" : "POST", body: JSON.stringify({ fileName: file.name, contentType: file.type, byteSize: file.size }) }); const uploaded = await fetch(intent.upload.url, { method: intent.upload.method, headers: intent.upload.headers, body: file }); if (!uploaded.ok) throw new Error("The image could not be uploaded."); await new Promise(resolve => window.setTimeout(resolve, 400)); await reload(); } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); setReplacement(undefined); } };
  const remove = async (imageId: string | number) => { setBusy(true); setError(""); try { await request<void>(`/profile/${encodeURIComponent(String(profileId))}/images/${encodeURIComponent(String(imageId))}`, { method: "DELETE" }); setValue(current => current.filter(image => image.id !== String(imageId))); } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); } };
  const saveDescription = async (imageId: string | number) => { try { const saved = await request<Image>(`/profile/${encodeURIComponent(String(profileId))}/images/${encodeURIComponent(String(imageId))}/description`, { method: "PUT", body: JSON.stringify({ description: drafts[String(imageId)] || "" }) }); setValue(current => current.map(image => image.id === saved.id ? saved : image)); } catch (cause) { setError((cause as Error).message); } };
  const gallery: GalleryImage[] = value.map(image => ({ ...image, resourceType: "profile", resourceId: profileId }));
  return <section className="mt-3" aria-label="Profile album"><StackedImageGallery mode="multiple" images={gallery} title={`${title} album`} emptyText="No profile images yet." editable={editable && !busy} onAddImage={editable ? () => openPicker() : undefined} onReplaceImage={editable ? image => openPicker(String(image.id)) : undefined} onDeleteImage={editable ? remove : undefined} imageDrafts={drafts} onDescriptionChange={(id, description) => setDrafts(current => ({ ...current, [String(id)]: description }))} onDescriptionBlur={id => { void saveDescription(id); }} />{editable && <Form.Control ref={input} type="file" accept="image/jpeg,image/png,image/gif" className="d-none" onChange={upload} disabled={busy} />}{busy && <p role="status" className="small mt-2">Saving image…</p>}{error && <Alert variant="danger" className="mt-2">{error}</Alert>}</section>;
}
