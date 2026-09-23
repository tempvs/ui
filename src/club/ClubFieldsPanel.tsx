import React from 'react';
import { useIntl } from 'react-intl';

import EditableDescriptionField from '../component/EditableDescriptionField';
import EditableSelectFieldRow from '../component/EditableSelectFieldRow';
import { SaveStatus } from '../component/EditableFieldRow';
import EditableTextFieldRow from '../component/EditableTextFieldRow';
import { PERIODS, getPeriodLabel } from '../util/periods';
import { Club, ClubDraft } from './clubApi';

export type ClubField = keyof ClubDraft;

type ClubFieldsPanelProps = {
  club: Club;
  editable: boolean;
  statuses: Partial<Record<ClubField, SaveStatus>>;
  onChange: (field: ClubField, value: string) => void;
  onBlur: (field: ClubField) => void;
};

/** Shared inline-edit presentation for Club metadata, using the Profile field controls. */
export default function ClubFieldsPanel({ club, editable, statuses, onChange, onBlur }: ClubFieldsPanelProps) {
  const intl = useIntl();
  return <section className="club-panel">
    <EditableTextFieldRow label="Club name" editable={editable} value={club.name} readOnlyValue={club.name}
      onChange={event => onChange('name', event.target.value)} onBlur={() => onBlur('name')}
      status={statuses.name} savingTitle="Saving" errorTitle="Save failed" />
    <EditableDescriptionField editable={editable} value={club.description || ''} readOnlyValue={club.description || 'No description yet.'}
      onValueChange={value => onChange('description', value)} onBlur={() => onBlur('description')}
      status={statuses.description} className="mb-2" textClassName="club-description" savingTitle="Saving" errorTitle="Save failed" />
    <EditableTextFieldRow label="Location" editable={editable} value={club.location || ''} readOnlyValue={club.location || '-'}
      onChange={event => onChange('location', event.target.value)} onBlur={() => onBlur('location')}
      status={statuses.location} savingTitle="Saving" errorTitle="Save failed" />
    <EditableTextFieldRow label="Contact email" editable={editable} value={club.contactEmail || ''} readOnlyValue={club.contactEmail || '-'} type="email"
      onChange={event => onChange('contactEmail', event.target.value)} onBlur={() => onBlur('contactEmail')}
      status={statuses.contactEmail} savingTitle="Saving" errorTitle="Save failed" />
    <EditableSelectFieldRow label="Period" editable={editable} value={club.period} readOnlyValue={getPeriodLabel(intl, club.period)}
      options={PERIODS.map(period => ({ value: period, label: getPeriodLabel(intl, period) }))}
      onChange={event => onChange('period', event.target.value)} onBlur={() => onBlur('period')}
      status={statuses.period} savingTitle="Saving" errorTitle="Save failed" />
  </section>;
}
