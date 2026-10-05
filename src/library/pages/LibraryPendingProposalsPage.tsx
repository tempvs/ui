import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, Form } from "react-bootstrap";
import { useIntl } from "react-intl";
import { Link, useParams } from "react-router-dom";

import Spinner from "../../component/Spinner";
import TextFilterInput from "../../component/TextFilterInput";
import { getErrorMessage } from "../../util/errors";
import {
  findSources,
  getLibraryViewer,
  getSourceProposals,
  type LibrarySource,
} from "../libraryApi";
import { canEditSource } from "../libraryRoles";
import {
  CLASSIFICATIONS,
  PAGE_SIZE,
  PERIODS,
  TYPES,
  getClassificationLabel,
  getPeriodLabel,
  getTypeLabel,
} from "../libraryShared";
import LibrarySectionHeader from "../components/LibrarySectionHeader";

type Row = { source: LibrarySource; count: number };

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
  const [rows, setRows] = useState<Row[]>([]);
  const [nextToken, setNextToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const [selectedClassification, setSelectedClassification] = useState("");
  const [selectedType, setSelectedType] = useState("");

  const sourceFilters = useMemo(
    () => ({
      query: query.trim() || undefined,
      period: period?.toUpperCase() || selectedPeriod || undefined,
      classifications: selectedClassification ? [selectedClassification] : undefined,
      types: selectedType ? [selectedType] : undefined,
    }),
    [period, query, selectedClassification, selectedPeriod, selectedType],
  );

  const load = useCallback(async (token?: string) => {
    const result = await findSources({
      ...sourceFilters,
      size: PROPOSALS_PAGE_SIZE,
      nextToken: token,
    });
    if (!result.ok) throw new Error("Unable to load sources.");
    const candidates = result.data || [];
    const counts = await Promise.all(
      candidates.map(async (source) => {
        const proposals = await getSourceProposals(source.id);
        return { source, count: proposals.ok ? (proposals.data || []).length : 0 };
      }),
    );
    return {
      rows: counts.filter((row) => row.count > 0),
      nextToken: result.nextToken,
    };
  }, [sourceFilters]);

  useEffect(() => {
    let active = true;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const viewer = await getLibraryViewer();
        if (!canEditSource(viewer)) {
          throw new Error("Library editor access is required to review proposals.");
        }
        const result = await load();
        if (active) {
          setRows(result.rows);
          setNextToken(result.nextToken);
        }
      } catch (caught) {
        if (active) setError(getErrorMessage(caught));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [load]);

  const loadMore = async () => {
    if (!nextToken || loadingMore) return;
    setLoadingMore(true);
    try {
      const result = await load(nextToken);
      setRows((current) => [...current, ...result.rows]);
      setNextToken(result.nextToken);
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setLoadingMore(false);
    }
  };

  const heading = period ? "Pending period proposals" : "All pending source proposals";
  return <>
    <div className="d-flex justify-content-between align-items-center gap-3 mb-4 flex-wrap">
      <h1 className="h3 mb-0">{heading}</h1>
    </div>
    <div className="d-flex align-items-center gap-2 flex-wrap mb-4">
      <div style={{ minWidth: "15rem", flex: "1 1 18rem" }}>
        <TextFilterInput
          ariaLabel="Filter pending source proposals"
          placeholder="Filter by source name"
          value={query}
          onChange={setQuery}
        />
      </div>
      {!period && (
        <Form.Select
          aria-label="Filter pending proposals by period"
          value={selectedPeriod}
          onChange={(event) => setSelectedPeriod(event.target.value)}
          style={{ width: "auto", minWidth: "11rem" }}
        >
          <option value="">All periods</option>
          {PERIODS.map((value) => (
            <option key={value} value={value}>{getPeriodLabel(intl, value)}</option>
          ))}
        </Form.Select>
      )}
      <Form.Select
        aria-label="Filter pending proposals by source type"
        value={selectedType}
        onChange={(event) => setSelectedType(event.target.value)}
        style={{ width: "auto", minWidth: "10rem" }}
      >
        <option value="">All types</option>
        {TYPES.map((value) => (
          <option key={value} value={value}>{getTypeLabel(intl, value)}</option>
        ))}
      </Form.Select>
      <Form.Select
        aria-label="Filter pending proposals by classification"
        value={selectedClassification}
        onChange={(event) => setSelectedClassification(event.target.value)}
        style={{ width: "auto", minWidth: "12rem" }}
      >
        <option value="">All classifications</option>
        {CLASSIFICATIONS.map((value) => (
          <option key={value} value={value}>{getClassificationLabel(intl, value)}</option>
        ))}
      </Form.Select>
    </div>
    {error && <div className="tempvs-plain-message text-danger">{error}</div>}
    {loading && <Spinner />}
    {!loading && rows.length === 0 && <div className="tempvs-plain-message text-muted">No pending proposals.</div>}
    {!loading && rows.map(({ source, count }) => (
      <div key={source.id} className="stash-shell p-3 mb-2 d-flex justify-content-between align-items-center gap-3 flex-wrap">
        <div className="d-flex flex-column gap-2" style={{ minWidth: 0 }}>
          <Link to={`/library/source/${source.id}/proposals`} className="text-reset text-decoration-none text-truncate"><strong>{source.name}</strong></Link>
          <div className="d-flex align-items-center gap-2 flex-wrap text-muted small">
            {source.period && <Badge bg="light" text="dark" className="border">{getPeriodLabel(intl, source.period)}</Badge>}
            {source.type && <Badge bg="info">{getTypeLabel(intl, source.type)}</Badge>}
            {source.classification && <Badge bg="secondary">{getClassificationLabel(intl, source.classification)}</Badge>}
          </div>
        </div>
        <span className="badge text-bg-dark rounded-pill" title="Pending proposals">{count}</span>
      </div>
    ))}
    {nextToken && <Button variant="outline-dark" disabled={loadingMore} onClick={() => void loadMore()}>{loadingMore ? "Loading…" : "Load more"}</Button>}
  </>;
}

/** Dedicated period queue route; it supplies the shared page header. */
export default function LibraryPendingProposalsPage() {
  const { period } = useParams();

  return <div className="page-layout-content px-4 px-xl-5 pb-4">
    <LibrarySectionHeader
      title="LIBRARY"
      subtitle={null}
      period={period}
      rightContent={<Link className="btn btn-outline-dark btn-sm" to={`/library/period/${period}`}>Back</Link>}
    />
    <LibraryPendingProposalsContent period={period} />
  </div>;
}
