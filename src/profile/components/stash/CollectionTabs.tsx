import React from 'react';

import PlusActionButton from '../../../component/PlusActionButton';
import { DraftFields, Id, MessageFormatter, StashGroup, StashItem } from '../../profileTypes';

type IdRecord<T> = Record<Id, T>;

type CollectionTabsProps = {
  groups: StashGroup[];
  activeGroupId?: Id | null;
  groupDrafts: IdRecord<DraftFields>;
  itemsByGroup: IdRecord<StashItem[]>;
  editable: boolean;
  t: MessageFormatter;
  onSelectGroup: (groupId: Id) => void;
  onCreateGroup: () => void;
};

export default function CollectionTabs({
  groups,
  activeGroupId,
  groupDrafts,
  itemsByGroup,
  editable,
  t,
  onSelectGroup,
  onCreateGroup,
}: CollectionTabsProps) {
  if (!groups.length) {
    return null;
  }

  return (
    <div className="stash-collection-tabs mb-3" role="tablist" aria-label={t('profile.stash.collectionsTitle', 'Collections')}>
      {groups.map(group => {
        const items = itemsByGroup[group.id] || [];
        const sourceCount = items.reduce((count, item) => count + (item.sources || []).length, 0);
        const isActive = group.id === activeGroupId;

        return (
          <button
            key={group.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`stash-collection-tab ${isActive ? 'stash-collection-tab-active' : ''}`.trim()}
            onClick={() => onSelectGroup(group.id)}
          >
            <span className="stash-collection-tab-name">{groupDrafts[group.id]?.name || group.name}</span>
            <span className="stash-collection-tab-meta">
              {items.length} {t('profile.stash.itemsCount', 'item(s)')} - {sourceCount} {t('profile.stash.sourcesCount', 'source(s)')}
            </span>
          </button>
        );
      })}
      {editable && (
        <div className="stash-collection-tab-add">
          <PlusActionButton
            title={t('profile.stash.groupCreate', 'Create collection')}
            onClick={onCreateGroup}
          />
        </div>
      )}
    </div>
  );
}
