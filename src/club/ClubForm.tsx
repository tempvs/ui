import React, { useState } from 'react';
import { Button, Form } from 'react-bootstrap';
import { useIntl } from 'react-intl';
import { getPeriodLabel, PERIODS, Period } from '../util/periods';
import { ClubDraft } from './clubApi';

export default function ClubForm({ initial, busy, onSave, onCancel }: {
  initial?: ClubDraft; busy: boolean; onSave: (draft: ClubDraft) => void; onCancel: () => void;
}) {
  const intl = useIntl();
  const t = (id: string, defaultMessage: string) => intl.formatMessage({ id: `clubs.${id}`, defaultMessage });
  const [draft, setDraft] = useState<ClubDraft>(initial || { name: '', description: '', location: '', contactEmail: '', period: 'OTHER' });
  return <Form className="club-form" onSubmit={event => { event.preventDefault(); onSave(draft); }}>
    <fieldset disabled={busy}>
      <Form.Group controlId="club-name" className="mb-3">
        <Form.Label>{t('name', 'Club name')}</Form.Label>
        <Form.Control required maxLength={120} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} />
      </Form.Group>
      <Form.Group controlId="club-description" className="mb-3">
        <Form.Label>{t('description', 'Description')}</Form.Label>
        <Form.Control as="textarea" rows={4} maxLength={5000} value={draft.description || ''} onChange={e => setDraft({ ...draft, description: e.target.value })} />
      </Form.Group>
      <div className="club-form-grid">
        <Form.Group controlId="club-period">
          <Form.Label>{t('period', 'Period')}</Form.Label>
          <Form.Select required value={draft.period} onChange={e => setDraft({ ...draft, period: e.target.value as Period })}>
            {PERIODS.map(period => <option key={period} value={period}>{getPeriodLabel(intl, period)}</option>)}
          </Form.Select>
        </Form.Group>
        <Form.Group controlId="club-location">
          <Form.Label>{t('location', 'Location')}</Form.Label>
          <Form.Control maxLength={255} value={draft.location || ''} onChange={e => setDraft({ ...draft, location: e.target.value })} />
        </Form.Group>
        <Form.Group controlId="club-email">
          <Form.Label>{t('email', 'Contact email')}</Form.Label>
          <Form.Control type="email" maxLength={255} value={draft.contactEmail || ''} onChange={e => setDraft({ ...draft, contactEmail: e.target.value })} />
        </Form.Group>
      </div>
      <div className="club-actions mt-4">
        <Button variant="secondary" type="submit">{t('save', 'Save club')}</Button>
        <Button variant="outline-secondary" onClick={onCancel}>{t('cancel', 'Cancel')}</Button>
      </div>
    </fieldset>
  </Form>;
}
