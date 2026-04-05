import React from 'react';
import { Form } from 'react-bootstrap';
import { FaHourglassHalf, FaTrashAlt, FaUpload } from 'react-icons/fa';

import EditableImageDescription from '../../component/EditableImageDescription';
import IconActionButton from '../../component/IconActionButton';
import ModalImage from '../../component/ModalImage';
import Spinner from '../../component/Spinner';

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
}) {
  const hasDescription = Boolean((avatarInfo || '').trim());

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
                alt={avatarInfo}
                description={avatarInfo}
                wrapperStyle={{ maxWidth: '100%' }}
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
          <IconActionButton
            className="position-absolute top-0 start-0 m-2"
            onClick={onOpenFilePicker}
            title={t('profile.avatar.uploadTitle', 'Upload picture')}
          >
            {avatarUploadStatus === 'uploading' ? <FaHourglassHalf className="text-muted" /> : <FaUpload />}
          </IconActionButton>
        )}
        {isEditable && avatarVisible && (
          <IconActionButton
            className="position-absolute top-0 end-0 m-2"
            fontSize="0.85rem"
            onClick={onDelete}
            title={t('profile.avatar.deleteTitle', 'Delete picture')}
          >
            <FaTrashAlt />
          </IconActionButton>
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
