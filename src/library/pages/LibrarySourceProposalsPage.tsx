import { useCallback, useEffect, useState } from "react";
import { Button } from "react-bootstrap";
import { Link, useParams } from "react-router-dom";

import { getErrorMessage } from "../../util/errors";
import LibraryPeriodBreadcrumb from "../components/LibraryPeriodBreadcrumb";
import LibrarySectionHeader from "../components/LibrarySectionHeader";
import {
  getLibraryViewer,
  getSource,
  getSourceChangesets,
  type LibrarySource,
  type SourceChangeset,
} from "../libraryApi";
import { canEditSource } from "../libraryRoles";
import LibraryProposalWorkspace from "./LibraryProposalWorkspace";

const PROPOSALS_PAGE_SIZE = 20;

export default function LibrarySourceProposalsPage() {
  const { sourceId } = useParams();
  return <SourceProposals key={sourceId} sourceId={sourceId} />;
}

function SourceProposals({ sourceId }: { sourceId?: string }) {
  const [source, setSource] = useState<LibrarySource | null>(null);
  const [changesets, setChangesets] = useState<SourceChangeset[]>([]);
  const [nextToken, setNextToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [sourceResult, viewer, changesetsResult] = await Promise.all([
          getSource(sourceId),
          getLibraryViewer(),
          getSourceChangesets(sourceId, undefined, PROPOSALS_PAGE_SIZE),
        ]);
        if (!sourceResult.ok || !sourceResult.data) {
          throw new Error("Unable to load the source.");
        }
        if (!canEditSource(viewer) || !changesetsResult.ok) {
          throw new Error("Library editor access is required to review changesets.");
        }
        if (!active) return;
        setSource(sourceResult.data);
        setChangesets(changesetsResult.data?.content || []);
        setNextToken(changesetsResult.data?.nextToken || null);
      } catch (caught) {
        if (active) setError(getErrorMessage(caught));
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [sourceId]);

  const loadMore = async () => {
    if (!sourceId || !nextToken || loadingMore) return;
    setLoadingMore(true);
    setError(null);
    try {
      const result = await getSourceChangesets(sourceId, nextToken, PROPOSALS_PAGE_SIZE);
      if (!result.ok) throw new Error("Unable to load more changesets.");
      setChangesets((current) => [...current, ...(result.data?.content || [])]);
      setNextToken(result.data?.nextToken || null);
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setLoadingMore(false);
    }
  };

  const updateProposal = useCallback((updated: SourceChangeset) => {
    setChangesets((current) => current.map((changeset) =>
      changeset.id === updated.id && changeset.version <= updated.version
        ? updated
        : changeset,
    ));
  }, []);

  return (
    <div className="page-layout-content px-4 px-xl-5 pb-4">
      <LibrarySectionHeader
        title="LIBRARY"
        subtitle={null}
        rightContent={
          source ? (
            <LibraryPeriodBreadcrumb
              period={source.period}
              variant="source"
              trailingItem={{
                label: source.name,
                to: `/library/source/${source.id}`,
              }}
            />
          ) : null
        }
      />
      <div className="d-flex justify-content-between align-items-center gap-3 mb-4 flex-wrap">
        <div>
          <h1 className="h3 mb-1">Source changesets</h1>
          {source && <div className="text-muted">{source.name}</div>}
        </div>
        {source && (
          <Link className="btn btn-dark btn-sm" to={`/library/source/${source.id}/edit`}>
            Edit source
          </Link>
        )}
      </div>
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      <LibraryProposalWorkspace
        rows={source ? changesets.map((changeset) => ({ source, changeset })) : []}
        loading={loading}
        emptyMessage={error ? "No proposals loaded." : "No changesets for this source."}
        onUpdated={updateProposal}
        pagination={nextToken && (
          <Button
            variant="outline-dark"
            size="sm"
            disabled={loadingMore}
            onClick={() => void loadMore()}
          >
            {loadingMore ? "Loading…" : "Load more"}
          </Button>
        )}
      />
    </div>
  );
}
