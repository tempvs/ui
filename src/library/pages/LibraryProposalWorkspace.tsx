import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { Button } from "react-bootstrap";
import { useIntl } from "react-intl";

import Spinner from "../../component/Spinner";
import { summarizeSourceChangeset } from "../components/SourceChangesetDiff";
import type { PendingSourceChangeset, SourceChangeset } from "../libraryApi";
import { getPeriodLabel, getProposalStatusLabel } from "../libraryShared";
import { LibrarySourceChangesetReview } from "./LibrarySourceChangesetPage";

type Props = {
  rows: PendingSourceChangeset[];
  emptyMessage: string;
  onUpdated: (changeset: SourceChangeset) => void;
  filters?: ReactNode;
  pagination?: ReactNode;
  showPeriod?: boolean;
  loading?: boolean;
};

export default function LibraryProposalWorkspace({
  rows,
  emptyMessage,
  onUpdated,
  filters,
  pagination,
  showPeriod,
  loading,
}: Props) {
  const intl = useIntl();
  const panelId = useId();
  const list = useRef<HTMLElement>(null);
  const panel = useRef<HTMLElement>(null);
  const previousRow = useRef<HTMLButtonElement>(null);
  const returnToQueue = useRef(false);
  const [selected, setSelected] = useState<{
    sourceId: string;
    changesetId: string;
  } | null>(null);
  const [locked, setLocked] = useState(false);
  const rowsLocked = locked || loading;

  useEffect(() => {
    if (selected) {
      panel.current?.focus({ preventScroll: true });
      if (panel.current && panel.current.getBoundingClientRect().top < 0) {
        panel.current.scrollIntoView({ block: "start" });
      }
    } else if (returnToQueue.current) {
      returnToQueue.current = false;
      (previousRow.current?.isConnected ? previousRow.current : list.current)?.focus();
    }
  }, [selected]);

  return (
    <div className="proposal-workspace" data-selected={Boolean(selected)}>
      <section
        className="proposal-workspace-list"
        aria-label="Proposals"
        aria-busy={Boolean(loading)}
        ref={list}
        tabIndex={-1}
      >
        {filters && <fieldset disabled={locked} className="proposal-filters">{filters}</fieldset>}
        {loading && rows.length === 0 && <Spinner />}
        {!loading && rows.length === 0 && (
          <p className="proposal-empty text-muted mb-0">{emptyMessage}</p>
        )}
        {rows.length > 0 && (
          <ul className="proposal-list list-unstyled mb-0">
            {rows.map(({ source, changeset }) => {
              const active = selected?.changesetId === changeset.id;
              const summary = summarizeSourceChangeset(
                changeset.base,
                changeset.proposed,
                changeset.imageOperations,
                changeset.kind,
              );
              return (
                <li key={changeset.id}>
                  <button
                    type="button"
                    className="proposal-list-row"
                    aria-current={active || undefined}
                    aria-controls={panelId}
                    disabled={rowsLocked}
                    onClick={(event) => {
                      previousRow.current = event.currentTarget;
                      setSelected({ sourceId: source.id, changesetId: changeset.id });
                    }}
                  >
                    <strong>{changeset.proposed.name || source.name}</strong>
                    <span className="text-muted small">
                      {showPeriod && source.period ? `${getPeriodLabel(intl, source.period)} · ` : ""}
                      {summary.join(" · ") || "No content changes"}
                    </span>
                    <span className="proposal-status" data-status={changeset.status}>
                      {getProposalStatusLabel(changeset.status)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {!loading && pagination && (
          <fieldset disabled={locked} className="proposal-pagination">{pagination}</fieldset>
        )}
      </section>
      <section
        id={panelId}
        className="proposal-workspace-panel"
        aria-label="Proposal review"
        ref={panel}
        tabIndex={-1}
      >
        {selected ? (
          <>
            <div className="proposal-workspace-back">
              <Button
                type="button"
                size="sm"
                variant="outline-dark"
                disabled={locked}
                onClick={() => {
                  returnToQueue.current = true;
                  setSelected(null);
                }}
              >
                ← Back to proposals
              </Button>
            </div>
            <LibrarySourceChangesetReview
              key={selected.changesetId}
              sourceId={selected.sourceId}
              changesetId={selected.changesetId}
              onUpdated={onUpdated}
              onLockChange={setLocked}
            />
          </>
        ) : (
          <p className="proposal-empty text-muted mb-0">Select a proposal to review its changes.</p>
        )}
      </section>
    </div>
  );
}
