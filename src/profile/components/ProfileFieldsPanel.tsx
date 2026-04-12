import React from 'react';

import EditableSelectFieldRow from '../../component/EditableSelectFieldRow';
import EditableTextFieldRow from '../../component/EditableTextFieldRow';
import { SaveStatus } from '../../component/EditableFieldRow';

type Translator = (id: string, defaultMessage: string, values?: Record<string, unknown>) => string;

type ProfileFieldsState = {
  firstName?: string | null;
  lastName?: string | null;
  nickName?: string | null;
  profileEmail?: string | null;
  location?: string | null;
  alias?: string | null;
  period?: string | null;
  fieldStatuses?: Record<string, SaveStatus>;
};

type ProfileFieldsPanelProps = {
  type?: string | null;
  state: ProfileFieldsState;
  periods: string[];
  t: Translator;
  getPeriodLabel: (period?: string | null) => string;
  editable: boolean;
  onInputChange: (event: { target: { name: string; value: string } }) => void;
  onFieldBlur: (field: string) => void;
};

export default function ProfileFieldsPanel({
  type,
  state,
  periods,
  t,
  getPeriodLabel,
  editable,
  onInputChange,
  onFieldBlur,
}: ProfileFieldsPanelProps) {
  return (
    <>
      <EditableTextFieldRow
        label={t('profile.field.firstNameRequired', 'First name *')}
        editable={editable}
        value={state.firstName || ''}
        readOnlyValue={state.firstName}
        onChange={event => onInputChange({ target: { name: 'firstName', value: event.target.value } })}
        onBlur={() => onFieldBlur('firstName')}
        status={state.fieldStatuses?.firstName}
        className="mb-2"
        savingTitle={t('profile.status.saving', 'Saving')}
        errorTitle={t('profile.status.saveFailed', 'Save failed')}
      />
      <EditableTextFieldRow
        label={t('profile.field.lastNameRequired', 'Last name *')}
        editable={editable}
        value={state.lastName || ''}
        readOnlyValue={state.lastName}
        onChange={event => onInputChange({ target: { name: 'lastName', value: event.target.value } })}
        onBlur={() => onFieldBlur('lastName')}
        status={state.fieldStatuses?.lastName}
        className="mb-2"
        savingTitle={t('profile.status.saving', 'Saving')}
        errorTitle={t('profile.status.saveFailed', 'Save failed')}
      />
      <EditableTextFieldRow
        label={t('profile.field.nickName', 'Nick name')}
        editable={editable}
        value={state.nickName || ''}
        readOnlyValue={state.nickName || '-'}
        onChange={event => onInputChange({ target: { name: 'nickName', value: event.target.value } })}
        onBlur={() => onFieldBlur('nickName')}
        status={state.fieldStatuses?.nickName}
        className="mb-2"
        savingTitle={t('profile.status.saving', 'Saving')}
        errorTitle={t('profile.status.saveFailed', 'Save failed')}
      />
      <EditableTextFieldRow
        label={t('profile.field.email', 'Profile email')}
        editable={editable}
        value={state.profileEmail || ''}
        readOnlyValue={state.profileEmail || '-'}
        onChange={event => onInputChange({ target: { name: 'profileEmail', value: event.target.value } })}
        onBlur={() => onFieldBlur('profileEmail')}
        status={state.fieldStatuses?.profileEmail}
        type="email"
        className="mb-2"
        savingTitle={t('profile.status.saving', 'Saving')}
        errorTitle={t('profile.status.saveFailed', 'Save failed')}
      />
      <EditableTextFieldRow
        label={t('profile.field.location', 'Location')}
        editable={editable}
        value={state.location || ''}
        readOnlyValue={state.location || '-'}
        onChange={event => onInputChange({ target: { name: 'location', value: event.target.value } })}
        onBlur={() => onFieldBlur('location')}
        status={state.fieldStatuses?.location}
        className="mb-2"
        savingTitle={t('profile.status.saving', 'Saving')}
        errorTitle={t('profile.status.saveFailed', 'Save failed')}
      />
      <EditableTextFieldRow
        label={t('profile.field.alias', 'Alias')}
        editable={editable}
        value={state.alias || ''}
        readOnlyValue={state.alias || '-'}
        onChange={event => onInputChange({ target: { name: 'alias', value: event.target.value } })}
        onBlur={() => onFieldBlur('alias')}
        status={state.fieldStatuses?.alias}
        className="mb-2"
        savingTitle={t('profile.status.saving', 'Saving')}
        errorTitle={t('profile.status.saveFailed', 'Save failed')}
      />
      {type === 'CLUB' && (
        <EditableSelectFieldRow
          label={t('profile.field.periodRequired', 'Period *')}
          editable={editable}
          value={state.period || ''}
          readOnlyValue={getPeriodLabel(state.period) || '-'}
          onChange={event => onInputChange({ target: { name: 'period', value: event.target.value } })}
          onBlur={() => onFieldBlur('period')}
          status={state.fieldStatuses?.period}
          options={[
            { value: '', label: t('profile.period.choose', 'Choose a period') },
            ...periods.map(period => ({ value: period, label: getPeriodLabel(period) })),
          ]}
          className="mb-2"
          savingTitle={t('profile.status.saving', 'Saving')}
          errorTitle={t('profile.status.saveFailed', 'Save failed')}
        />
      )}
    </>
  );
}
