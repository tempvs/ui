import React from 'react';
import { Button, Form } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { FaLink, FaUnlink } from 'react-icons/fa';

import SearchActionButton from '../../../component/SearchActionButton';
import Spinner from '../../../component/Spinner';
import { Id, LibrarySourceSummary, MessageFormatter, SourceSearchState, StashItem } from '../../profileTypes';

type IdRecord<T> = Record<Id, T>;

const LinkIcon = FaLink as React.ComponentType<{ className?: string }>;
const UnlinkIcon = FaUnlink as React.ComponentType;

type LinkedSourcesPanelProps = {
  item: StashItem;
  editable: boolean;
  visible: boolean;
  sourceDetails: IdRecord<LibrarySourceSummary>;
  sourceState: SourceSearchState;
  t: MessageFormatter;
  getTypeLabel: (sourceType?: string | null) => string;
  onToggleSearch: () => void;
  onQueryChange: (value: string) => void;
  onSearch: () => void;
  onLinkSource: (sourceId: Id) => void;
  onUnlinkSource: (sourceId: Id) => void;
};

export default function LinkedSourcesPanel({
  item,
  editable,
  visible,
  sourceDetails,
  sourceState,
  t,
  getTypeLabel,
  onToggleSearch,
  onQueryChange,
  onSearch,
  onLinkSource,
  onUnlinkSource,
}: LinkedSourcesPanelProps) {
  return (
    <>
      <div className="d-flex justify-content-between align-items-center gap-2 mb-2">
        <div className="stash-subheading mb-0 text-start">
          {t('profile.stash.sourcesTitle', 'Sources')}
        </div>
        {editable && (
          <Button
            type="button"
            variant="link"
            className="stash-text-action"
            onClick={onToggleSearch}
          >
            {visible ? t('profile.action.done', 'Done') : t('profile.stash.sourceAdd', 'Add source')}
          </Button>
        )}
      </div>

      {(item.sources || []).length === 0 && (
        <div className="small text-muted mb-2">
          {t('profile.stash.sourcesEmpty', 'No supporting sources linked yet.')}
        </div>
      )}

      <div className="stash-source-chip-row">
        {(item.sources || []).map(sourceId => {
          const source = sourceDetails[sourceId];
          return (
            <span key={sourceId} className="stash-source-chip">
              {source ? (
                <Link to={`/library/source/${sourceId}`} className="stash-source-name text-decoration-none" title={source.name || undefined}>
                  {source.name}
                </Link>
              ) : (
                <span className="text-muted">#{sourceId}</span>
              )}
              {editable && (
                <button
                  type="button"
                  className="stash-source-chip-remove"
                  onClick={() => onUnlinkSource(sourceId)}
                  aria-label={t('profile.stash.sourceUnlink', 'Unlink source')}
                >
                  <UnlinkIcon />
                </button>
              )}
            </span>
          );
        })}
      </div>

      {editable && visible && (
        <div className="stash-source-search-panel mt-3">
          <div className="input-group input-group-sm mb-2">
            <Form.Control
              value={sourceState.query || ''}
              onChange={event => onQueryChange(event.target.value)}
              placeholder={t('profile.stash.sourceSearchPlaceholder', 'Find matching library sources')}
            />
            <SearchActionButton
              title={t('profile.stash.search', 'Search')}
              onClick={onSearch}
              className="rounded-0 rounded-end"
              borderColor="#ced4da"
              color="#495057"
            />
          </div>
          {sourceState.error && <div className="small text-danger mb-2">{sourceState.error}</div>}
          {sourceState.loading && <Spinner size="sm" />}
          {(sourceState.results || []).length > 0 && (
            <div className="d-grid gap-2">
              {(sourceState.results || []).map(source => (
                <div key={source.id} className="stash-source-result">
                  <div className="small stash-source-result-copy">
                    <Link to={`/library/source/${source.id}`} className="stash-source-result-name fw-semibold text-decoration-none" title={source.name || undefined}>
                      {source.name}
                    </Link>
                    <div className="text-muted">{getTypeLabel(source.type)}</div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline-secondary"
                    disabled={(item.sources || []).includes(source.id)}
                    onClick={() => onLinkSource(source.id)}
                  >
                    <LinkIcon className="me-2" />
                    {t('profile.stash.link', 'Link')}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
