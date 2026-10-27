import React from 'react';

import InlineEditableText from '../../../component/InlineEditableText';
import PlusActionButton from '../../../component/PlusActionButton';
import { SaveStatus } from '../../../component/EditableFieldRow';
import { DraftFields, FieldName, MessageFormatter, StashGroup } from '../../profileTypes';

type FieldStatusMap = Partial<Record<FieldName, SaveStatus>>;

type StashCollectionHeaderProps = {
  group: StashGroup;
  draft?: DraftFields;
  statuses?: FieldStatusMap;
  metadata: string[];
  editable: boolean;
  t: MessageFormatter;
  onFieldChange: (field: FieldName, value: string) => void;
  onFieldBlur: (field: FieldName) => void;
  onAddItem: () => void;
};

export default function StashCollectionHeader({
  group,
  draft,
  statuses,
  metadata,
  editable,
  t,
  onFieldChange,
  onFieldBlur,
  onAddItem,
}: StashCollectionHeaderProps) {
  const groupDescription = draft?.description || group.description || '';
  const groupDescriptionMissing = !groupDescription;
  const groupDescriptionDisplay = groupDescription || t('profile.stash.noDescription', 'No description');

  return (
    <div className="stash-collection-header d-flex justify-content-between align-items-start gap-3 flex-wrap mb-3">
      <div className="stash-collection-heading">
        <span className="d-block stash-collection-copy" style={{ minWidth: 0 }}>
          <InlineEditableText
            editable={editable}
            value={draft?.name || ''}
            readOnlyValue={group.name}
            onChange={event => onFieldChange('name', event.target.value)}
            onBlur={() => onFieldBlur('name')}
            status={statuses?.name}
            textClassName="stash-collection-title"
          />
          <InlineEditableText
            editable={editable}
            value={draft?.description || ''}
            readOnlyValue={groupDescriptionDisplay}
            onChange={event => onFieldChange('description', event.target.value)}
            onBlur={() => onFieldBlur('description')}
            status={statuses?.description}
            textClassName="stash-collection-description"
            placeholderDisplay={groupDescriptionMissing}
            placeholder={t('profile.stash.noDescription', 'No description')}
            className="mt-1"
          />
          <span className="stash-meta-row mt-2">
            {metadata.map(value => (
              <span key={value} className="stash-meta-chip">{value}</span>
            ))}
          </span>
        </span>
      </div>
      {editable && (
        <div className="d-flex align-items-center gap-2">
          <PlusActionButton
            title={t('profile.stash.itemCreate', 'Add item')}
            onClick={onAddItem}
          />
        </div>
      )}
    </div>
  );
}
