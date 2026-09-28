import React from 'react';
import { Form } from 'react-bootstrap';
import { FaHourglassHalf, FaUpload } from 'react-icons/fa';

import ImageOverlayActionButton from '../../component/ImageOverlayActionButton';
import Spinner from '../../component/Spinner';
import { SaveStatus } from '../../component/EditableFieldRow';
import StackedImageGallery from '../../component/StackedImageGallery';
import { MessageFormatter } from '../profileTypes';

type ProfileAvatarPanelProps = {
  avatarPanelWidth: string;
  avatarVisible: boolean;
  avatarLoaded: boolean;
  avatarUrl?: string | null;
  profileId?: string | number | null;
  avatarInfo?: string | null;
  avatarUploadStatus?: string | null;
  avatarUploadMessage?: string | null;
  avatarDescriptionDraft?: string | null;
  avatarDescriptionStatus?: SaveStatus;
  isEditable: boolean;
  initials?: string;
  t: MessageFormatter;
  onUploadChange?: React.ChangeEventHandler<HTMLInputElement>;
  onOpenFilePicker?: () => void;
  onDelete?: () => void;
  onDescriptionChange?: (value: string) => void;
  onDescriptionBlur?: () => void;
};

type IconProps = {
  className?: string;
};

const SavingIcon = FaHourglassHalf as React.ComponentType<IconProps>;
const UploadIcon = FaUpload as React.ComponentType;

export default function ProfileAvatarPanel({
  avatarPanelWidth,
  avatarVisible,
  avatarLoaded,
  avatarUrl,
  profileId,
  avatarInfo,
  avatarUploadStatus,
  avatarUploadMessage,
  avatarDescriptionDraft,
  avatarDescriptionStatus,
  isEditable,
  initials,
  t,
  onUploadChange,
  onOpenFilePicker,
  onDelete,
  onDescriptionChange,
  onDescriptionBlur,
}: ProfileAvatarPanelProps) {
  const uploadControl = avatarUploadStatus === 'uploading' ? <SavingIcon className="text-muted" /> : <UploadIcon />;

  return (
    <>
      <div className="position-relative d-inline-block w-100" style={{ maxWidth: avatarPanelWidth }}>
        <div
          style={{
            width: '100%',
            maxWidth: avatarPanelWidth,
            border: '4px #eee groove',
            backgroundColor: '#fff',
          }}
        >
          {avatarVisible
            ? (
              <StackedImageGallery
                mode="single"
                images={[{
                  id: profileId || 'profile-avatar',
                  url: avatarUrl,
                  resourceType: 'profile',
                  resourceId: profileId,
                  description: avatarInfo,
                }]}
                title={t('profile.avatar.title', 'Profile picture')}
                editable={isEditable}
                onReplaceImage={isEditable ? () => onOpenFilePicker?.() : undefined}
                onDeleteImage={isEditable ? () => onDelete?.() : undefined}
                imageDrafts={{ [String(profileId || 'profile-avatar')]: avatarDescriptionDraft || '' }}
                imageStatuses={{ [String(profileId || 'profile-avatar')]: avatarDescriptionStatus || null }}
                onDescriptionChange={(_, value) => onDescriptionChange?.(value)}
                onDescriptionBlur={() => onDescriptionBlur?.()}
                replaceTitle={t('profile.avatar.replace', 'Replace image')}
                replacePopover={t('profile.avatar.replace', 'Replace image')}
                deleteTitle={t('profile.avatar.delete', 'Delete image')}
                deleteConfirmTitle={t('profile.avatar.deleteTitle', 'Delete image')}
                deleteConfirmMessage={t('profile.avatar.deleteConfirm', 'Delete this image?')}
                deleteLabel={t('profile.action.delete', 'Delete')}
                cancelLabel={t('profile.action.cancel', 'Cancel')}
                previewStyle={{ maxWidth: '100%' }}
                showInlineDescription
              />
            ) : avatarLoaded ? (
              <div
                style={{
                  width: '100%',
                  aspectRatio: '1 / 1',
                  minHeight: '12rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '3rem',
                  fontWeight: 'bold',
                  color: '#666',
                  backgroundColor: '#f8f9fa',
                }}
              >
                {initials}
              </div>
            ) : (
              <div className="p-4 text-center"><Spinner /></div>
          )}
        </div>
        {isEditable && (
          <ImageOverlayActionButton
            className="position-absolute top-0 start-0 m-2"
            onClick={onOpenFilePicker}
            title="Replace"
            popover="Replace"
          >
            {uploadControl}
          </ImageOverlayActionButton>
        )}
      </div>
      {isEditable && (
        <div className="mt-3">
          <Form.Control
            id="avatarUploadInput"
            type="file"
            accept="image/jpeg,image/png,image/gif"
            onChange={onUploadChange}
            disabled={avatarUploadStatus === 'uploading'}
            className="d-none"
          />
          {avatarUploadMessage && (
            <div className={`${avatarUploadStatus === 'error' ? 'text-danger' : 'text-success'} small text-center`}>
              {avatarUploadMessage}
            </div>
          )}
        </div>
      )}
    </>
  );
}
