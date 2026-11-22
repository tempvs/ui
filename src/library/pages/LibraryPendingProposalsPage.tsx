import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Form } from "react-bootstrap";
import { useIntl } from "react-intl";
import { Link, useParams } from "react-router-dom";

import TextFilterInput from "../../component/TextFilterInput";
import { getErrorMessage } from "../../util/errors";
import LibraryProposalWorkspace from "./LibraryProposalWorkspace";
import {
  getLibraryViewer,
  getPendingSourceChangesets,
  type PendingSourceChangeset,
  type SourceChangeset,
} from "../libraryApi";
import { canEditSource } from "../libraryRoles";
import {
  PAGE_SIZE,
  PERIODS,
  TYPES,
  getPeriodLabel,
  getTypeLabel,
} from "../libraryShared";
import LibrarySectionHeader from "../components/LibrarySectionHeader";
import { useLibraryTopic } from "../onboarding/LibraryJourney";

type PendingProposalsContentProps = {
  period?: string | null;
};

const PROPOSALS_PAGE_SIZE = Math.min(PAGE_SIZE, 20);

/**
 * The queue body is intentionally headerless. It is shared by the dedicated
 * period route and the Library administration tab, which already owns a page
 * header and must not render another jumbo.
 */
export function LibraryPendingProposalsContent({
  period,
}: PendingProposalsContentProps) {
  const intl = useIntl();
  const [rows, setRows] = useState<PendingSourceChangeset[]>([]);
  const [nextToken, setNextToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  useLibraryTopic("status", !loading && !error);
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const requestScope = useRef<AbortController | null>(null);

  const sourceFilters = useMemo(
    () => ({
      query: query.trim() || undefined,
      period: period?.toUpperCase() || selectedPeriod || undefined,
      type: selectedType || undefined,
    }),
    [period, query, selectedPeriod, selectedType],
  );

  const load = useCallback(
    async (token?: string) => {
      const result = await getPendingSourceChangesets({
        ...sourceFilters,
        limit: PROPOSALS_PAGE_SIZE,
        nextToken: token,
      });
      if (!result.ok) throw new Error("Unable to load pending changesets.");
      return {
        rows: result.data?.content || [],
        nextToken: result.data?.nextToken || null,
      };
    },
    [sourceFilters],
  );

  useEffect(() => {
    const scope = new AbortController();
    requestScope.current = scope;
    void (async () => {
      setLoading(true);
      setLoadingMore(false);
      setError(null);
      try {
        const viewer = await getLibraryViewer();
        if (!canEditSource(viewer)) {
          throw new Error(
            "Library editor access is required to review changesets.",
          );
        }
        const result = await load();
        if (!scope.signal.aborted) {
          setRows(result.rows);
          setNextToken(result.nextToken);
        }
      } catch (caught) {
        if (!scope.signal.aborted) {
          setError(getErrorMessage(caught));
          setRows([]);
          setNextToken(null);
        }
      } finally {
        if (!scope.signal.aborted) setLoading(false);
      }
    })();
    return () => {
      scope.abort();
    };
  }, [load]);

  const loadMore = async () => {
    if (!nextToken || loadingMore) return;
    const scope = requestScope.current;
    setLoadingMore(true);
    try {
      const result = await load(nextToken);
      if (scope?.signal.aborted) return;
      setRows((current) => [...current, ...result.rows]);
      setNextToken(result.nextToken);
    } catch (caught) {
      if (!scope?.signal.aborted) setError(getErrorMessage(caught));
    } finally {
      if (!scope?.signal.aborted) setLoadingMore(false);
    }
  };

  const updateProposal = useCallback((updated: SourceChangeset) => {
    setRows((current) => {
      if (updated.status !== "PENDING" && updated.status !== "APPROVED") {
        return current.filter(({ changeset }) => changeset.id !== updated.id);
      }
      return current.map((row) =>
        row.changeset.id === updated.id && row.changeset.version <= updated.version
          ? { ...row, changeset: updated }
          : row,
      );
    });
  }, []);

  const heading = period
    ? "Period review and publication queue"
    : "Source review and publication queue";
  return (
    <>
      <div className="d-flex justify-content-between align-items-center gap-3 mb-4 flex-wrap">
        <h1 className="h3 mb-0">{heading}</h1>
      </div>
      {error && <div className="tempvs-plain-message text-danger" role="alert">{error}</div>}
      <LibraryProposalWorkspace
        rows={rows}
        loading={loading}
        emptyMessage={error ? "No proposals loaded." : "No proposals awaiting review or publication."}
        onUpdated={updateProposal}
        showPeriod={!period}
        filters={
          <>
            <TextFilterInput
              ariaLabel="Filter pending source changesets"
              placeholder="Filter by source name"
              value={query}
              onChange={setQuery}
            />
            {!period && (
              <Form.Select
                size="sm"
                aria-label="Filter pending changesets by period"
                value={selectedPeriod}
                onChange={(event) => setSelectedPeriod(event.target.value)}
              >
                <option value="">All periods</option>
                {PERIODS.map((value) => (
                  <option key={value} value={value}>
                    {getPeriodLabel(intl, value)}
                  </option>
                ))}
              </Form.Select>
            )}
            <Form.Select
              size="sm"
              aria-label="Filter pending proposals by source type"
              value={selectedType}
              onChange={(event) => setSelectedType(event.target.value)}
            >
              <option value="">All types</option>
              {TYPES.map((value) => (
                <option key={value} value={value}>
                  {getTypeLabel(intl, value)}
                </option>
              ))}
            </Form.Select>
          </>
        }
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
    </>
  );
}

/** Library-wide or period-specific queue with the shared page header. */
export default function LibraryPendingProposalsPage() {
  const { period } = useParams();

  return (
    <div className="page-layout-content px-4 px-xl-5 pb-4">
      <LibrarySectionHeader
        title="LIBRARY"
        subtitle={null}
        period={period}
        middleContent={
          <Link
            className="btn btn-outline-dark btn-sm"
            to={period ? `/library/period/${period}` : "/library"}
          >
            Back
          </Link>
        }
      />
      <LibraryPendingProposalsContent key={period} period={period} />
    </div>
  );
}
