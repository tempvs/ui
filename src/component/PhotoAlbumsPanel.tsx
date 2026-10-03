import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Form, Modal } from "react-bootstrap";
import { FaPlus } from "react-icons/fa";

import ConfirmationModal from "./ConfirmationModal";
import DefaultHourglassImage from "./DefaultHourglassImage";
import IconActionButton from "./IconActionButton";
import StackedImageGallery, { type GalleryImage } from "./StackedImageGallery";
import TextFilterInput from "./TextFilterInput";
import { getImageThumbnails } from "../image/imageApi";
import RefreshingImage from "../image/RefreshingImage";
import "./PhotoAlbumsPanel.css";

type TargetType = "profile" | "club" | "event";
type Album = { id: string; name: string; description: string | null };
const PlusIcon = FaPlus as React.ComponentType;

async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/images/albums${path}`, {
    ...options,
    headers: { "content-type": "application/json", ...(options.headers || {}) },
  });
  if (response.status === 204) return undefined as T;
  const body = (await response.json().catch(() => undefined)) as
    { message?: string } | undefined;
  if (!response.ok)
    throw new Error(body?.message || "Unable to update photo albums.");
  return body as T;
}

async function albumImages(id: string): Promise<GalleryImage[]> {
  const response = await fetch(
    `/api/images/album/${encodeURIComponent(id)}?limit=100`,
  );
  if (!response.ok) throw new Error("Unable to load album images.");
  return (
    ((await response.json()) as { content?: GalleryImage[] }).content || []
  );
}

export default function PhotoAlbumsPanel({
  targetType,
  targetId,
  editable,
}: {
  targetType: TargetType;
  targetId: string | number;
  editable: boolean;
}) {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [covers, setCovers] = useState<Record<string, GalleryImage | null>>({});
  const [selected, setSelected] = useState<Album | null>(null);
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [filter, setFilter] = useState("");
  const [draft, setDraft] = useState({ name: "", description: "" });
  const [imageDrafts, setImageDrafts] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState(false);
  const [removing, setRemoving] = useState<Album | null>(null);
  const [replacement, setReplacement] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const file = useRef<HTMLInputElement>(null);

  const reload = useCallback(async () => {
    const page = await api<{ content: Album[] }>(
      `/${targetType}/${encodeURIComponent(String(targetId))}`,
    );
    setAlbums(page.content);
    const thumbnails = await getImageThumbnails(
      page.content.map((album) => ({
        resourceType: "album",
        resourceId: album.id,
      })),
    ).catch(() => []);
    setCovers(
      Object.fromEntries(
        thumbnails.map((value) => [
          value.resourceId,
          value.image as GalleryImage | null,
        ]),
      ),
    );
  }, [targetId, targetType]);

  useEffect(() => {
    void reload().catch(() => undefined);
  }, [reload]);

  const openAlbum = async (album: Album) => {
    setSelected(album);
    setDraft({ name: album.name, description: album.description || "" });
    setError("");
    try {
      const found = await albumImages(album.id);
      setImages(found);
      setImageDrafts(
        Object.fromEntries(
          found.map((image) => [String(image.id), image.description || ""]),
        ),
      );
    } catch (cause) {
      setError((cause as Error).message);
    }
  };

  const close = () => {
    if (busy) return;
    setCreating(false);
    setSelected(null);
    setError("");
  };

  const saveAlbum = async () => {
    if (!draft.name.trim()) return;
    setBusy(true);
    setError("");
    try {
      if (selected) {
        const saved = await api<Album>(`/${encodeURIComponent(selected.id)}`, {
          method: "PUT",
          body: JSON.stringify(draft),
        });
        setAlbums((current) =>
          current.map((album) => (album.id === saved.id ? saved : album)),
        );
        setSelected(saved);
      } else {
        const saved = await api<Album>("", {
          method: "POST",
          body: JSON.stringify({
            targetType,
            targetId: String(targetId),
            ...draft,
          }),
        });
        setAlbums((current) => [saved, ...current]);
        setSelected(saved);
        setImages([]);
        setImageDrafts({});
      }
      setCreating(false);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const upload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const picked = event.target.files?.[0];
    event.target.value = "";
    if (!picked || !selected) return;
    if (
      !["image/jpeg", "image/png", "image/gif"].includes(picked.type) ||
      picked.size > 20 * 1024 * 1024
    ) {
      setError("Choose a JPEG, PNG, or GIF image up to 20 MB.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const path = `/api/images/album/${encodeURIComponent(selected.id)}${
        replacement ? `/${encodeURIComponent(replacement)}` : ""
      }`;
      const intentResponse = await fetch(path, {
        method: replacement ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          replacement
            ? {
                replacement: {
                  fileName: picked.name,
                  contentType: picked.type,
                  byteSize: picked.size,
                },
              }
            : {
                fileName: picked.name,
                contentType: picked.type,
                byteSize: picked.size,
              },
        ),
      });
      const intent = (await intentResponse.json()) as {
        upload?: {
          method: string;
          url: string;
          headers: Record<string, string>;
        };
        message?: string;
      };
      if (!intentResponse.ok || !intent.upload)
        throw new Error(intent.message || "Unable to prepare image upload.");
      const stored = await fetch(intent.upload.url, {
        method: intent.upload.method,
        headers: intent.upload.headers,
        body: picked,
      });
      if (!stored.ok) throw new Error("The image could not be uploaded.");
      await new Promise((resolve) => window.setTimeout(resolve, 400));
      const found = await albumImages(selected.id);
      setImages(found);
      setImageDrafts(
        Object.fromEntries(
          found.map((image) => [String(image.id), image.description || ""]),
        ),
      );
      await reload();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
      setReplacement(undefined);
    }
  };

  const saveImageDescription = async (imageId: GalleryImage["id"]) => {
    if (!selected) return;
    try {
      const response = await fetch(
        `/api/images/album/${encodeURIComponent(selected.id)}/${encodeURIComponent(String(imageId))}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            description: imageDrafts[String(imageId)] || "",
          }),
        },
      );
      const body = (await response.json().catch(() => undefined)) as
        { image?: GalleryImage; message?: string } | undefined;
      if (!response.ok || !body?.image)
        throw new Error(body?.message || "Unable to save image description.");
      setImages((current) =>
        current.map((image) => (image.id === imageId ? body.image! : image)),
      );
    } catch (cause) {
      setError((cause as Error).message);
    }
  };

  const deleteImage = async (imageId: GalleryImage["id"]) => {
    if (!selected) return;
    setBusy(true);
    try {
      const response = await fetch(
        `/api/images/album/${encodeURIComponent(selected.id)}/delete`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ imageIds: [String(imageId)] }),
        },
      );
      if (!response.ok) throw new Error("Unable to delete image.");
      setImages((current) => current.filter((image) => image.id !== imageId));
      await reload();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const removeAlbum = async () => {
    if (!removing) return;
    setBusy(true);
    try {
      await api<void>(`/${encodeURIComponent(removing.id)}`, {
        method: "DELETE",
      });
      setAlbums((current) =>
        current.filter((album) => album.id !== removing.id),
      );
      setRemoving(null);
      setSelected(null);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const visibleAlbums = albums.filter((album) =>
    album.name.toLocaleLowerCase().includes(filter.trim().toLocaleLowerCase()),
  );

  return (
    <section
      className="club-panel photo-albums-panel mt-4"
      aria-label="Photo albums"
    >
      <div className="d-flex align-items-center justify-content-between gap-2 mb-2">
        <h2 className="h5 mb-0">Photo albums</h2>
        <div className="d-flex align-items-center gap-2">
          <TextFilterInput
            value={filter}
            onChange={setFilter}
            placeholder="Filter albums"
            ariaLabel="Filter photo albums by name"
            className="photo-albums-filter"
          />
          {editable && (
            <IconActionButton
              title="Create photo album"
              size="1.8rem"
              fontSize=".75rem"
              onClick={() => {
                setDraft({ name: "", description: "" });
                setCreating(true);
                setError("");
              }}
            >
              <PlusIcon />
            </IconActionButton>
          )}
        </div>
      </div>
      {albums.length ? (
        <div className="photo-album-tiles">
          {visibleAlbums.map((album) => (
            <button
              type="button"
              className="photo-album-tile"
              key={album.id}
              onClick={() => void openAlbum(album)}
            >
              <div className="photo-album-tile-cover">
                {covers[album.id]?.id !== undefined ? (
                  <RefreshingImage
                    image={{ ...covers[album.id], resourceType: "album", resourceId: album.id } as GalleryImage}
                    variant="thumbnail"
                    alt={album.name}
                  />
                ) : (
                  <DefaultHourglassImage alt="No album image yet." />
                )}
              </div>
              <div className="photo-album-tile-copy">
                <strong>{album.name}</strong>
                {album.description && <span>{album.description}</span>}
              </div>
            </button>
          ))}
          {visibleAlbums.length === 0 && (
            <p className="text-muted mb-0">No photo albums match this filter.</p>
          )}
        </div>
      ) : (
        <p className="text-muted mb-0">No photo albums yet.</p>
      )}

      <Modal
        show={creating || selected !== null}
        onHide={close}
        size="lg"
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>
            {selected ? selected.name : "Create photo album"}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {error && <Alert variant="danger">{error}</Alert>}
          {editable ? (
            <>
              <Form.Group className="mb-2">
                <Form.Label>Album name</Form.Label>
                <Form.Control
                  value={draft.name}
                  maxLength={120}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Description</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={2}
                  maxLength={2000}
                  value={draft.description}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                />
              </Form.Group>
              <div className="d-flex justify-content-between mb-3">
                <IconActionButton
                  title={selected ? "Save album" : "Create album"}
                  size="2rem"
                  fontSize=".75rem"
                  disabled={busy || !draft.name.trim()}
                  onClick={() => void saveAlbum()}
                >
                  <PlusIcon />
                </IconActionButton>
                {selected && (
                  <IconActionButton
                    title="Delete album"
                    size="2rem"
                    fontSize=".75rem"
                    onClick={() => setRemoving(selected)}
                  >
                    ×
                  </IconActionButton>
                )}
              </div>
            </>
          ) : (
            selected?.description && (
              <p className="text-muted">{selected.description}</p>
            )
          )}
          {selected && (
            <>
              <StackedImageGallery
                mode="multiple"
                images={images.map((image) => ({
                  ...image,
                  resourceType: "album",
                  resourceId: selected.id,
                }))}
                title={selected.name}
                editable={editable && !busy}
                onAddImage={
                  editable
                    ? () => {
                        setReplacement(undefined);
                        file.current?.click();
                      }
                    : undefined
                }
                onReplaceImage={
                  editable
                    ? (image) => {
                        setReplacement(String(image.id));
                        file.current?.click();
                      }
                    : undefined
                }
                onDeleteImage={editable ? deleteImage : undefined}
                imageDrafts={imageDrafts}
                onDescriptionChange={(imageId, value) =>
                  setImageDrafts((current) => ({
                    ...current,
                    [String(imageId)]: value,
                  }))
                }
                onDescriptionBlur={(imageId) =>
                  void saveImageDescription(imageId)
                }
              />
              {editable && (
                <Form.Control
                  ref={file}
                  className="d-none"
                  type="file"
                  accept="image/jpeg,image/png,image/gif"
                  onChange={upload}
                  disabled={busy}
                />
              )}
            </>
          )}
        </Modal.Body>
      </Modal>
      <ConfirmationModal
        show={removing !== null}
        title="Delete photo album"
        message="Delete this album and all of its images?"
        confirmLabel="Delete"
        busy={busy}
        onHide={() => !busy && setRemoving(null)}
        onConfirm={() => void removeAlbum()}
      />
    </section>
  );
}
