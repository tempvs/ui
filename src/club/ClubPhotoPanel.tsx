import React, { useRef, useState } from "react";
import { Alert, Form } from "react-bootstrap";
import { FaHourglassHalf } from "react-icons/fa";
import { useIntl } from "react-intl";

import StackedImageGallery from "../component/StackedImageGallery";
import { Club, removeClubPhoto, uploadClubPhoto } from "./clubApi";

const SavingIcon = FaHourglassHalf as React.ComponentType<{
  className?: string;
}>;

export default function ClubPhotoPanel({
  club,
  onChange,
}: {
  club: Club;
  onChange: (club: Club) => void;
}) {
  const intl = useIntl();
  const t = (id: string, defaultMessage: string) =>
    intl.formatMessage({ id: `clubs.${id}`, defaultMessage });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasPhoto = Boolean(club.photoUrl || club.hasPhoto);
  const openFilePicker = () => {
    if (!busy) fileInputRef.current?.click();
  };
  const upload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (
      !["image/jpeg", "image/png"].includes(file.type) ||
      file.size > 5 * 1024 * 1024
    ) {
      setError(
        t("photoRequirements", "Choose a JPEG or PNG photo up to 5 MB."),
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      onChange(await uploadClubPhoto(club.id, file));
    } catch (caught) {
      setError(
        (caught as Error).message ||
          t("photoUploadFailed", "Unable to upload the photo right now."),
      );
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    setBusy(true);
    setError("");
    try {
      onChange(await removeClubPhoto(club.id));
    } catch (caught) {
      setError(
        (caught as Error).message ||
          t("photoRemoveFailed", "Unable to remove the photo right now."),
      );
    } finally {
      setBusy(false);
    }
  };

  if (!hasPhoto && !club.canManage) return null;

  return (
    <section
      className="club-panel club-photo-panel"
      aria-label={t("photo", "Club photo")}
    >
      <StackedImageGallery
        mode="single"
        images={
          hasPhoto
            ? [
                {
                  id: club.photoImageId || `club-${club.id}`,
                  resourceType: "club",
                  resourceId: club.id,
                  url: club.photoUrl,
                  thumbnailUrl: club.photoThumbnailUrl,
                },
              ]
            : []
        }
        title={club.name}
        imageClassName="club-detail-photo"
        emptyText={t("photoEmpty", "No club photo yet.")}
        editable={club.canManage && !busy}
        onUploadImage={club.canManage ? openFilePicker : undefined}
        onReplaceImage={club.canManage ? openFilePicker : undefined}
        onDeleteImage={club.canManage ? remove : undefined}
        replaceTitle={t("replacePhoto", "Replace club photo")}
        replacePopover={t("replacePhoto", "Replace club photo")}
        uploadTitle={t("uploadPhotoIcon", "Upload photo")}
        uploadPopover={t("uploadPhotoIcon", "Upload photo")}
        deleteTitle={t("removePhoto", "Remove photo")}
        deleteConfirmTitle={t("removePhoto", "Remove photo")}
        deleteConfirmMessage={t(
          "removePhotoConfirm",
          "Remove this club photo?",
        )}
      />
      {club.canManage && (
        <Form.Group>
          <Form.Label
            htmlFor={`club-photo-${club.id}`}
            className="visually-hidden"
          >
            {t("uploadPhoto", "Upload club photo")}
          </Form.Label>
          <Form.Control
            id={`club-photo-${club.id}`}
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png"
            disabled={busy}
            onChange={upload}
            className="d-none"
          />
        </Form.Group>
      )}
      {busy && (
        <p role="status" className="mt-2">
          <SavingIcon className="me-2" />
          {t("savingPhoto", "Saving photo…")}
        </p>
      )}
      {error && (
        <Alert variant="danger" className="mt-2">
          {error}
        </Alert>
      )}
    </section>
  );
}
