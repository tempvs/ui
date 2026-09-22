import React, { useState } from 'react';
import { FaHourglassHalf } from 'react-icons/fa';
import { Alert, Button, Form } from 'react-bootstrap';
import { useIntl } from 'react-intl';
import { Club, isClubServiceUnavailable, removeClubPhoto, uploadClubPhoto } from './clubApi';
import RefreshingImage from '../image/RefreshingImage';

const SavingIcon = FaHourglassHalf as React.ComponentType<{ className?: string }>;

export default function ClubPhotoPanel({ club, onChange, onUnavailable }: {
  club: Club; onChange: (club: Club) => void; onUnavailable?: () => void;
}) {
  const intl = useIntl();
  const t = (id: string, defaultMessage: string) => intl.formatMessage({ id: `clubs.${id}`, defaultMessage });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const upload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setError(t('photoRequirements', 'Choose a JPEG or PNG photo up to 5 MB.')); return;
    }
    setBusy(true); setError('');
    try { onChange(await uploadClubPhoto(club.id, file)); }
    catch (e) {
      if (isClubServiceUnavailable(e)) onUnavailable?.();
      else setError((e as Error).message);
    }
    finally { setBusy(false); }
  };
  const remove = async () => {
    setBusy(true); setError('');
    try { onChange(await removeClubPhoto(club.id)); }
    catch (e) {
      if (isClubServiceUnavailable(e)) onUnavailable?.();
      else setError((e as Error).message);
    }
    finally { setBusy(false); }
  };
  if (!club.photoUrl && !club.hasPhoto && !club.canManage) return null;
  return <section className="club-panel club-photo-panel" aria-label={t('photo', 'Club photo')}>
    {(club.photoUrl || club.hasPhoto) && (
      <RefreshingImage
        image={{ id: club.photoImageId, resourceType: 'club', resourceId: club.id, url: club.photoUrl, thumbnailUrl: club.photoThumbnailUrl }}
        className="club-detail-photo"
        alt={club.name}
      />
    )}
    {club.canManage && <div className="mt-3">
      <Form.Group controlId={`club-photo-${club.id}`}>
        <Form.Label>{club.hasPhoto || club.photoUrl ? t('replacePhoto', 'Replace club photo') : t('uploadPhoto', 'Upload club photo')}</Form.Label>
        <Form.Control type="file" accept="image/jpeg,image/png" disabled={busy} onChange={upload} />
        <Form.Text>{t('photoRequirements', 'Choose a JPEG or PNG photo up to 5 MB.')}</Form.Text>
      </Form.Group>
      {(club.hasPhoto || club.photoUrl) && <Button variant="outline-danger" size="sm" className="mt-2" disabled={busy} onClick={remove}>{t('removePhoto', 'Remove photo')}</Button>}
    </div>}
    {busy && <p role="status" className="mt-2"><SavingIcon className="me-2" />{t('savingPhoto', 'Saving photo…')}</p>}
    {error && <Alert variant="danger" className="mt-2">{error}</Alert>}
  </section>;
}
