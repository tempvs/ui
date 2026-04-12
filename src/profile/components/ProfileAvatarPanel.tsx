import React from 'react';
import { Form } from 'react-bootstrap';
import { FaHourglassHalf, FaUpload } from 'react-icons/fa';

import ConfirmingTrashButton from '../../component/ConfirmingTrashButton';
import EditableImageDescription from '../../component/EditableImageDescription';
import ImageOverlayActionButton from '../../component/ImageOverlayActionButton';
import ModalImage from '../../component/ModalImage';
import Spinner from '../../component/Spinner';
import { SaveStatus } from '../../component/EditableFieldRow';
import { MessageFormatter } from '../profileTypes';

type ProfileAvatarPanelProps = {
  avatarPanelWidth: string;
  avatarVisible: boolean;
  avatarLoaded: boolean;
  avatarImage?: string | null;
  avatarUrl?: string | null;
  avatarInfo?: string | null;
  avatarUploadStatus?: string | null;
  avatarUploadMessage?: string | null;
  avatarDescriptionDraft?: string | null;
  avatarDescriptionStatus?: SaveStatus;
  isEditable: boolean;
  initials?: string;
  t: MessageFormatter;
  onUploadChange?: React.ChangeEventHandler<HTMLInputElement>;
  onOpenFilePicker?: React.MouseEventHandler<HTMLElement>;
  onDelete?: () => void;
  onDescriptionChange?: React.ChangeEventHandler<HTMLInputElement>;
  onDescriptionBlur?: React.FocusEventHandler<HTMLInputElement>;
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
  avatarImage,
  avatarUrl,
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
  const hasDescription = Boolean((avatarInfo || '').trim());
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
              <ModalImage
                src={avatarImage}
                url={avatarUrl}
                alt={avatarInfo || undefined}
                description={avatarInfo}
                wrapperStyle={{ maxWidth: '100%' }}
                modalTopLeftAction={isEditable ? (
                  <ImageOverlayActionButton
                    className="position-absolute top-0 start-0 m-3"
                    onClick={onOpenFilePicker}
                    title="Replace"
                    popover="Replace"
                  >
                    {uploadControl}
                  </ImageOverlayActionButton>
                ) : null}
                modalTopRightAction={isEditable ? (
                  <ConfirmingTrashButton
                    fontSize="0.85rem"
                    title="Delete"
                    confirmTitle={t('profile.avatar.deleteTitle', 'Delete image')}
                    confirmMessage={t('profile.avatar.deleteConfirm', 'Delete this image?')}
                    confirmLabel={t('profile.action.delete', 'Delete')}
                    cancelLabel={t('profile.action.cancel', 'Cancel')}
                    onConfirm={onDelete}
                  />
                ) : null}
                modalDescriptionContent={(
                  <EditableImageDescription
                    editable={isEditable}
                    value={isEditable ? avatarDescriptionDraft : avatarInfo}
                    status={avatarDescriptionStatus}
                    placeholder={t('profile.avatar.description.placeholder', 'Add a description')}
                    onChange={onDescriptionChange}
                    onBlur={onDescriptionBlur}
                    savingTitle={t('profile.status.saving', 'Saving')}
                    errorTitle={t('profile.status.saveFailed', 'Save failed')}
                    className="mt-3"
                    bordered={false}
                  />
                )}
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
          {avatarVisible && (isEditable || hasDescription) && (
            <EditableImageDescription
              editable={isEditable}
              value={isEditable ? avatarDescriptionDraft : avatarInfo}
              status={avatarDescriptionStatus}
              placeholder={t('profile.avatar.description.placeholder', 'Add a description')}
              onChange={onDescriptionChange}
              onBlur={onDescriptionBlur}
              savingTitle={t('profile.status.saving', 'Saving')}
              errorTitle={t('profile.status.saveFailed', 'Save failed')}
            />
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
        {isEditable && avatarVisible && (
          <ConfirmingTrashButton
            className="position-absolute top-0 end-0 m-2"
            fontSize="0.85rem"
            title="Delete"
            confirmTitle={t('profile.avatar.deleteTitle', 'Delete image')}
            confirmMessage={t('profile.avatar.deleteConfirm', 'Delete this image?')}
            confirmLabel={t('profile.action.delete', 'Delete')}
            cancelLabel={t('profile.action.cancel', 'Cancel')}
            onConfirm={onDelete}
          />
        )}
      </div>
      {isEditable && (
        <div className="mt-3">
          <Form.Control
            id="avatarUploadInput"
            type="file"
            accept="image/*"
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
