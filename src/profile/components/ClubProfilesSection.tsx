import React from 'react';
import { Button, Form, Modal } from 'react-bootstrap';

import PlusActionButton from '../../component/PlusActionButton';
import Spinner from '../../component/Spinner';
import { MessageFormatter } from '../profileTypes';

type ClubProfile = {
  id: string | number;
  firstName?: string | null;
  lastName?: string | null;
  nickName?: string | null;
};

type ClubProfilesSectionProps = {
  isUserProfile: boolean;
  canCreate: boolean;
  visibleClubProfiles: ClubProfile[];
  showEmptyMessage: boolean;
  clubProfilesLoaded: boolean;
  clubProfilesMessage?: React.ReactNode;
  clubProfileCreateVisible: boolean;
  clubProfileCreateError?: unknown;
  clubProfileDeleteTarget?: ClubProfile | null;
  clubProfileDeleteError?: unknown;
  periods: string[];
  getPeriodLabel: (period: string) => string;
  t: MessageFormatter;
  onShowCreate?: React.MouseEventHandler<HTMLElement>;
  onHideCreate?: () => void;
  onCreate?: React.FormEventHandler<HTMLFormElement>;
  onOpenProfile: (profile: ClubProfile) => void;
  onOpenDelete?: (profile: ClubProfile) => void;
  onHideDelete?: () => void;
  onDelete?: React.MouseEventHandler<HTMLButtonElement>;
};

export default function ClubProfilesSection({
  isUserProfile,
  canCreate,
  visibleClubProfiles,
  showEmptyMessage,
  clubProfilesLoaded,
  clubProfilesMessage,
  clubProfileCreateVisible,
  clubProfileCreateError,
  clubProfileDeleteTarget,
  clubProfileDeleteError,
  periods,
  getPeriodLabel,
  t,
  onShowCreate,
  onHideCreate,
  onCreate,
  onOpenProfile,
  onHideDelete,
  onDelete,
}: ClubProfilesSectionProps) {
  const clubProfileName = clubProfileDeleteTarget
    ? `${clubProfileDeleteTarget.firstName || ''} ${clubProfileDeleteTarget.lastName || ''}`.trim()
    : '';
  const createModalContent: React.ReactNode = (
    <>
      <p className="profile-entry-copy">
        {t('profile.clubProfile.create.subtitle', 'Create a club profile with its own name, alias, and contact details.')}
      </p>
      <div className="profile-entry-grid">
        <Form.Group controlId="clubFirstName" className="profile-entry-group">
          <Form.Label className="profile-entry-label">{t('profile.field.firstName', 'First name')} *</Form.Label>
          <Form.Control className="profile-entry-input" name="firstName" type="text" required />
        </Form.Group>
        <Form.Group controlId="clubLastName" className="profile-entry-group">
          <Form.Label className="profile-entry-label">{t('profile.field.lastName', 'Last name')} *</Form.Label>
          <Form.Control className="profile-entry-input" name="lastName" type="text" required />
        </Form.Group>
        <Form.Group controlId="clubNickName" className="profile-entry-group">
          <Form.Label className="profile-entry-label">{t('profile.field.nickName', 'Nick name')}</Form.Label>
          <Form.Control className="profile-entry-input" name="nickName" type="text" />
        </Form.Group>
        <Form.Group controlId="clubProfileEmail" className="profile-entry-group">
          <Form.Label className="profile-entry-label">{t('profile.field.email', 'Profile email')}</Form.Label>
          <Form.Control className="profile-entry-input" name="profileEmail" type="email" />
        </Form.Group>
        <Form.Group controlId="clubLocation" className="profile-entry-group">
          <Form.Label className="profile-entry-label">{t('profile.field.location', 'Location')}</Form.Label>
          <Form.Control className="profile-entry-input" name="location" type="text" />
        </Form.Group>
        <Form.Group controlId="clubAlias" className="profile-entry-group">
          <Form.Label className="profile-entry-label">{t('profile.field.alias', 'Alias')}</Form.Label>
          <Form.Control className="profile-entry-input" name="alias" type="text" />
        </Form.Group>
        <Form.Group controlId="clubPeriod" className="profile-entry-group profile-entry-group-full">
          <Form.Label className="profile-entry-label">{t('profile.field.period', 'Period')} *</Form.Label>
          <Form.Select className="profile-entry-input" name="period" required defaultValue="">
            <option value="">{t('profile.period.choose', 'Choose a period')}</option>
            {periods.map(period => (
              <option key={period} value={period}>{getPeriodLabel(period)}</option>
            ))}
          </Form.Select>
        </Form.Group>
      </div>
      {clubProfileCreateError ? (
        <div className="tempvs-plain-message profile-entry-message profile-entry-message-error">
          {t('profile.clubProfile.create.failed', 'Unable to create club profile right now.')}
        </div>
      ) : null}
      <div className="profile-entry-actions">
        <Button className="profile-entry-submit" variant="secondary" type="submit">
          {t('profile.clubProfile.create.submit', 'Create club profile')}
        </Button>
      </div>
    </>
  );
  const deleteModalContent: React.ReactNode = (
    <>
      <p className="profile-entry-copy mb-0">
        {t('profile.clubProfile.delete.confirm', 'Delete {name}?', {
          name: clubProfileName || t('profile.clubProfile.delete.fallbackName', 'this club profile'),
        })}
      </p>
      {clubProfileDeleteError ? (
        <div className="tempvs-plain-message profile-entry-message profile-entry-message-error">
          {t('profile.clubProfile.delete.failed', 'Deletion failed.')}
        </div>
      ) : null}
      <div className="profile-entry-actions profile-entry-actions-end">
        <Button className="profile-entry-secondary" variant="outline-secondary" onClick={onHideDelete}>
          {t('profile.action.cancel', 'Cancel')}
        </Button>
        <Button className="profile-entry-danger" variant="danger" onClick={onDelete}>
          {t('profile.clubProfile.delete.submit', 'Delete club profile')}
        </Button>
      </div>
    </>
  );

  return (
    <>
      {isUserProfile && (
        <div className="profile-club-section-header">
          <div>
            <h4 className="profile-club-section-title">{t('profile.clubProfiles.title', 'Club profiles')}</h4>
            <p className="profile-club-section-copy">
              {t('profile.clubProfiles.subtitle', 'Keep separate club identities ready for each period.')}
            </p>
          </div>
          {canCreate && (
            <PlusActionButton
              onClick={onShowCreate}
              title={t('profile.clubProfile.create.title', 'Create club profile')}
            />
          )}
        </div>
      )}
      {!clubProfilesLoaded && <Spinner />}
      {clubProfilesLoaded && clubProfilesMessage && (
        <div className="tempvs-plain-message profile-entry-message profile-entry-message-error">{clubProfilesMessage}</div>
      )}
      {clubProfilesLoaded && showEmptyMessage && (
        <div className="profile-club-empty">{t('profile.clubProfiles.empty', 'No club profiles yet.')}</div>
      )}
      {clubProfilesLoaded && visibleClubProfiles.length > 0 && (
        <div className="profile-club-list">
          {visibleClubProfiles.map(clubProfile => (
            <div key={clubProfile.id} className="profile-club-list-item">
              <Button
                variant="outline-secondary"
                className="profile-club-button"
                onClick={() => onOpenProfile(clubProfile)}
              >
                <span className="profile-club-button-name">
                  {clubProfile.firstName} {clubProfile.lastName}{clubProfile.nickName ? ` ${clubProfile.nickName}` : ''}
                </span>
                <span className="profile-club-button-meta">
                  {t('profile.clubProfiles.open', 'Open profile')}
                </span>
              </Button>
            </div>
          ))}
        </div>
      )}

      <Modal
        show={clubProfileCreateVisible}
        onHide={onHideCreate}
        centered
        dialogClassName="profile-entry-dialog"
        contentClassName="profile-entry-modal"
      >
        <Modal.Header closeButton className="profile-entry-modal-header">
          <div className="profile-entry-modal-title-block">
            <span className="profile-entry-modal-kicker">{t('profile.clubProfile.kicker', 'Club profile')}</span>
            <Modal.Title className="profile-entry-modal-title">{t('profile.clubProfile.create.title', 'Create club profile')}</Modal.Title>
          </div>
        </Modal.Header>
        <Modal.Body className="profile-entry-modal-body">
          <div>
            <form onSubmit={onCreate} className="profile-entry-form">
              <div>{createModalContent}</div>
            </form>
          </div>
        </Modal.Body>
      </Modal>

      <Modal
        show={Boolean(clubProfileDeleteTarget)}
        onHide={onHideDelete}
        centered
        dialogClassName="profile-entry-dialog profile-entry-dialog-compact"
        contentClassName="profile-entry-modal"
      >
        <Modal.Header closeButton className="profile-entry-modal-header">
          <div className="profile-entry-modal-title-block">
            <span className="profile-entry-modal-kicker">{t('profile.clubProfile.delete.kicker', 'Delete')}</span>
            <Modal.Title className="profile-entry-modal-title">{t('profile.clubProfile.delete.title', 'Delete club profile')}</Modal.Title>
          </div>
        </Modal.Header>
        <Modal.Body className="profile-entry-modal-body">
          <div>{deleteModalContent}</div>
        </Modal.Body>
      </Modal>
    </>
  );
}
