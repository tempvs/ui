import React from "react";
import { Form } from "react-bootstrap";

import Spinner from "../../component/Spinner";
import { SaveStatus } from "../../component/EditableFieldRow";
import StackedImageGallery, { GalleryImage } from "../../component/StackedImageGallery";
import { Avatar, Id, MessageFormatter } from "../profileTypes";

type ProfileAvatarPanelProps = {
  avatarPanelWidth: string;
  avatarLoaded: boolean;
  avatars: Avatar[];
  profileId?: string | number | null;
  avatarUploadStatus?: string | null;
  avatarUploadMessage?: string | null;
  avatarImageDrafts?: Record<string, string>;
  avatarImageStatuses?: Record<string, SaveStatus>;
  isEditable: boolean;
  initials?: string;
  t: MessageFormatter;
  onUploadChange?: React.ChangeEventHandler<HTMLInputElement>;
  onReplaceChange?: React.ChangeEventHandler<HTMLInputElement>;
  onOpenFilePicker?: () => void;
  onReplaceImage?: (image: GalleryImage) => void;
  onDelete?: (imageId: Id) => void;
  onDescriptionChange?: (imageId: Id, value: string) => void;
  onDescriptionBlur?: (imageId: Id) => void;
};

export default function ProfileAvatarPanel({
  avatarPanelWidth,
  avatarLoaded,
  avatars,
  profileId,
  avatarUploadStatus,
  avatarUploadMessage,
  avatarImageDrafts,
  avatarImageStatuses,
  isEditable,
  initials,
  t,
  onUploadChange,
  onReplaceChange,
  onOpenFilePicker,
  onReplaceImage,
  onDelete,
  onDescriptionChange,
  onDescriptionBlur,
}: ProfileAvatarPanelProps) {
  return (
    <section className="profile-avatar-panel">
      <div
        className="position-relative d-inline-block w-100"
        style={{ maxWidth: avatarPanelWidth }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: avatarPanelWidth,
            border: "4px #eee groove",
            backgroundColor: "#fff",
          }}
        >
          <StackedImageGallery
            mode="multiple"
            images={avatars.flatMap((avatar) =>
              avatar.id
                ? [{ ...avatar, id: avatar.id, resourceType: "profile", resourceId: profileId }]
                : [],
            )}
            title={t("profile.avatar.title", "Profile picture")}
            editable={isEditable}
            onAddImage={
              isEditable && avatarLoaded
                ? () => onOpenFilePicker?.()
                : undefined
            }
            canAddImage={isEditable && avatarLoaded}
            onReplaceImage={isEditable ? (image) => onReplaceImage?.(image) : undefined}
            onDeleteImage={isEditable ? (imageId) => onDelete?.(imageId) : undefined}
            imageDrafts={avatarImageDrafts}
            imageStatuses={avatarImageStatuses}
            onDescriptionChange={(imageId, value) => onDescriptionChange?.(imageId, value)}
            onDescriptionBlur={(imageId) => onDescriptionBlur?.(imageId)}
            replaceTitle={t("profile.avatar.replace", "Replace image")}
            replacePopover={t("profile.avatar.replace", "Replace image")}
            deleteTitle={t("profile.avatar.delete", "Delete image")}
            deleteConfirmTitle={t("profile.avatar.deleteTitle", "Delete image")}
            deleteConfirmMessage={t(
              "profile.avatar.deleteConfirm",
              "Delete this image?",
            )}
            deleteLabel={t("profile.action.delete", "Delete")}
            cancelLabel={t("profile.action.cancel", "Cancel")}
            uploadTitle={t("profile.avatar.upload", "Upload image")}
            uploadPopover={t("profile.avatar.upload", "Upload image")}
            previewStyle={{ maxWidth: "100%" }}
            showInlineDescription
            emptyContent={
              avatarLoaded ? (
                <div
                  style={{
                    width: "100%",
                    aspectRatio: "1 / 1",
                    minHeight: "12rem",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "3rem",
                    fontWeight: "bold",
                    color: "#666",
                    backgroundColor: "#f8f9fa",
                  }}
                >
                  {initials}
                </div>
              ) : (
                <div className="p-4 text-center">
                  <Spinner />
                </div>
              )
            }
          />
        </div>
      </div>
      {isEditable && (
        <div className="mt-3">
          <Form.Control
            id="avatarUploadInput"
            type="file"
            accept="image/jpeg,image/png,image/gif"
            multiple
            onChange={onUploadChange}
            disabled={avatarUploadStatus === "uploading"}
            className="d-none"
          />
          <Form.Control
            id="avatarReplaceInput"
            type="file"
            accept="image/jpeg,image/png,image/gif"
            onChange={onReplaceChange}
            disabled={avatarUploadStatus === "uploading"}
            className="d-none"
          />
          {avatarUploadMessage && (
            <div
              className={`${avatarUploadStatus === "error" ? "text-danger" : "text-success"} small text-center`}
            >
              {avatarUploadMessage}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
