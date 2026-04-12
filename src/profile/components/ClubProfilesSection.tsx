import React from 'react';
import { Button, Form, Modal } from 'react-bootstrap';
import { FaTimes } from 'react-icons/fa';

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

type IconProps = {
  className?: string;
  title?: string;
};

const ErrorIcon = FaTimes as React.ComponentType<IconProps>;

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

  return (
    <>
      {isUserProfile && (
        <div className="d-flex align-items-center justify-content-between mb-3">
          <h4 className="mb-0">{t('profile.clubProfiles.title', 'Club profiles')}</h4>
          {canCreate && (
            <PlusActionButton
              onClick={onShowCreate}
              title={t('profile.clubProfile.create.title', 'Create club profile')}
            />
          )}
        </div>
      )}
      {!clubProfilesLoaded && <Spinner />}
      {clubProfilesLoaded && clubProfilesMessage && <div>{clubProfilesMessage}</div>}
      {clubProfilesLoaded && showEmptyMessage && <div>{t('profile.clubProfiles.empty', 'No club profiles yet.')}</div>}
      {clubProfilesLoaded && visibleClubProfiles.length > 0 && (
        <div className="d-grid gap-2">
          {visibleClubProfiles.map(clubProfile => (
            <div key={clubProfile.id} className="d-flex gap-2">
              <Button
                variant="outline-secondary"
                className="text-start flex-grow-1"
                onClick={() => onOpenProfile(clubProfile)}
              >
                {clubProfile.firstName} {clubProfile.lastName}{clubProfile.nickName ? ` ${clubProfile.nickName}` : ''}
              </Button>
            </div>
          ))}
        </div>
      )}

      <Modal show={clubProfileCreateVisible} onHide={onHideCreate} centered>
        <Modal.Header closeButton>
          <Modal.Title>{t('profile.clubProfile.create.title', 'Create club profile')}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={onCreate}>
            <Form.Group controlId="clubFirstName" className="mb-3">
              <Form.Label>{t('profile.field.firstName', 'First name')} *</Form.Label>
              <Form.Control name="firstName" type="text" required />
            </Form.Group>
            <Form.Group controlId="clubLastName" className="mb-3">
              <Form.Label>{t('profile.field.lastName', 'Last name')} *</Form.Label>
              <Form.Control name="lastName" type="text" required />
            </Form.Group>
            <Form.Group controlId="clubNickName" className="mb-3">
              <Form.Label>{t('profile.field.nickName', 'Nick name')}</Form.Label>
              <Form.Control name="nickName" type="text" />
            </Form.Group>
            <Form.Group controlId="clubProfileEmail" className="mb-3">
              <Form.Label>{t('profile.field.email', 'Profile email')}</Form.Label>
              <Form.Control name="profileEmail" type="email" />
            </Form.Group>
            <Form.Group controlId="clubLocation" className="mb-3">
              <Form.Label>{t('profile.field.location', 'Location')}</Form.Label>
              <Form.Control name="location" type="text" />
            </Form.Group>
            <Form.Group controlId="clubAlias" className="mb-3">
              <Form.Label>{t('profile.field.alias', 'Alias')}</Form.Label>
              <Form.Control name="alias" type="text" />
            </Form.Group>
            <Form.Group controlId="clubPeriod" className="mb-3">
              <Form.Label>{t('profile.field.period', 'Period')} *</Form.Label>
              <Form.Select name="period" required defaultValue="">
                <option value="">{t('profile.period.choose', 'Choose a period')}</option>
                {periods.map(period => (
                  <option key={period} value={period}>{getPeriodLabel(period)}</option>
                ))}
              </Form.Select>
            </Form.Group>
            <div className="d-flex align-items-center justify-content-end gap-2">
              <>
                {clubProfileCreateError && <ErrorIcon className="text-danger" title={t('profile.create.failedShort', 'Creation failed')} />}
                <Button variant="secondary" type="submit">{t('profile.clubProfile.create.submit', 'Create club profile')}</Button>
              </>
            </div>
          </Form>
        </Modal.Body>
      </Modal>

      <Modal show={Boolean(clubProfileDeleteTarget)} onHide={onHideDelete} centered>
        <Modal.Header closeButton>
          <Modal.Title>{t('profile.clubProfile.delete.title', 'Delete club profile')}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <>
            <p className="mb-2">
              {t('profile.clubProfile.delete.confirm', 'Delete {name}?', {
                name: clubProfileName || t('profile.clubProfile.delete.fallbackName', 'this club profile'),
              })}
            </p>
            {clubProfileDeleteError && (
              <div className="mt-3 d-flex align-items-center gap-2 text-danger">
                <ErrorIcon title={t('profile.clubProfile.delete.failedShort', 'Deletion failed')} />
                <span>{t('profile.clubProfile.delete.failed', 'Deletion failed.')}</span>
              </div>
            )}
          </>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={onHideDelete}>
            {t('profile.action.cancel', 'Cancel')}
          </Button>
          <Button variant="danger" onClick={onDelete}>
            {t('profile.clubProfile.delete.submit', 'Delete club profile')}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
