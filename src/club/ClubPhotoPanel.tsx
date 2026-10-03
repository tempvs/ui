import React, { useEffect, useRef, useState } from "react";
import { Alert, Form } from "react-bootstrap";
import { FaHourglassHalf } from "react-icons/fa";
import { useIntl } from "react-intl";

import StackedImageGallery, { type GalleryImage } from "../component/StackedImageGallery";
import { type Club, deleteClubAlbumImage, getClubImages, type ClubImage, uploadClubAlbumImage, uploadClubPhoto } from "./clubApi";

const SavingIcon = FaHourglassHalf as React.ComponentType<{ className?: string }>;

export default function ClubPhotoPanel({ club, onChange }: { club: Club; onChange: (club: Club) => void }) {
  const intl = useIntl();
  const t = (id: string, defaultMessage: string) => intl.formatMessage({ id: `clubs.${id}`, defaultMessage });
  const legacyImage = club.photoUrl || club.photoThumbnailUrl ? [{ id: club.photoImageId || `club-${club.id}`, url: club.photoUrl || undefined, thumbnailUrl: club.photoThumbnailUrl || undefined, status: "READY" as const }] : [];
  const [images, setImages] = useState<ClubImage[]>(legacyImage);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [replacement, setReplacement] = useState<string | undefined>();
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { let active = true; getClubImages(club.id).then(value => { if (active && value.length) setImages(value); }).catch(() => undefined); return () => { active = false; }; }, [club.id]);
  const openPicker = (imageId?: string) => { setReplacement(imageId); input.current?.click(); };
  const upload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = "";
    if (!file) return;
    if (!["image/jpeg", "image/png"].includes(file.type) || file.size > 5 * 1024 * 1024) { setError(t("photoRequirements", "Choose a JPEG or PNG photo up to 5 MB.")); return; }
    setBusy(true); setError("");
    try {
      // Preserve the first image as the existing club cover so club lists and
      // legacy clients continue to have a single representative thumbnail.
      if (!replacement && !images.length) {
        const updated = await uploadClubPhoto(club.id, file);
        onChange(updated);
        await getClubImages(club.id).then(setImages).catch(() => undefined);
      } else {
        const saved = await uploadClubAlbumImage(club.id, file, replacement);
        setImages(current => replacement ? current.map(image => image.id === saved.id ? saved : image) : [...current, saved]);
      }
    }
    catch (caught) { setError((caught as Error).message || t("photoUploadFailed", "Unable to upload the photo right now.")); }
    finally { setBusy(false); setReplacement(undefined); }
  };
  const remove = async (imageId: string | number) => { setBusy(true); setError(""); try { await deleteClubAlbumImage(club.id, String(imageId)); setImages(current => current.filter(image => image.id !== String(imageId))); } catch (caught) { setError((caught as Error).message || t("photoRemoveFailed", "Unable to remove the photo right now.")); } finally { setBusy(false); } };
  const galleryImages: GalleryImage[] = images.map(image => ({ ...image, resourceType: "club", resourceId: club.id }));
  if (!images.length && !club.canManage) return null;
  return <section className="club-panel club-photo-panel" aria-label={t("photo", "Club photos")}>
    <StackedImageGallery mode="multiple" images={galleryImages} title={club.name} imageClassName="club-detail-photo" emptyText={t("photoEmpty", "No club photos yet.")} editable={club.canManage && !busy} onAddImage={club.canManage ? () => openPicker() : undefined} onReplaceImage={club.canManage ? image => openPicker(String(image.id)) : undefined} onDeleteImage={club.canManage ? remove : undefined} addTitle={t("addPhoto", "Add image")} />
    {club.canManage && <Form.Control aria-label="Upload club photo" ref={input} type="file" accept="image/jpeg,image/png" disabled={busy} onChange={upload} className="d-none" />}
    {busy && <p role="status" className="mt-2"><SavingIcon className="me-2" />{t("savingPhoto", "Saving photo…")}</p>}
    {error && <Alert variant="danger" className="mt-2">{error}</Alert>}
  </section>;
}
