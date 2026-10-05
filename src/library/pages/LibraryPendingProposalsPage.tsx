import { useCallback, useEffect, useState } from "react";
import { Button } from "react-bootstrap";
import { Link, useParams } from "react-router-dom";

import Spinner from "../../component/Spinner";
import { getErrorMessage } from "../../util/errors";
import { findSources, getLibraryViewer, getSourceProposals, type LibrarySource } from "../libraryApi";
import { canEditSource } from "../libraryRoles";
import { PAGE_SIZE } from "../libraryShared";
import LibrarySectionHeader from "../components/LibrarySectionHeader";

type Row = { source: LibrarySource; count: number };

/** Paginated source-level queue, scoped to a period when rendered from a period. */
export default function LibraryPendingProposalsPage({ admin = false }: { admin?: boolean }) {
  const { period } = useParams();
  const [rows, setRows] = useState<Row[]>([]);
  const [nextToken, setNextToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (token?: string) => {
    const result = await findSources({ period: period?.toUpperCase(), size: PAGE_SIZE, nextToken: token });
    if (!result.ok) throw new Error("Unable to load sources.");
    const candidates = result.data || [];
    const counts = await Promise.all(candidates.map(async (source) => {
      const proposals = await getSourceProposals(source.id);
      return { source, count: proposals.ok ? (proposals.data || []).length : 0 };
    }));
    return { rows: counts.filter((row) => row.count > 0), nextToken: result.nextToken };
  }, [period]);

  useEffect(() => {
    let active = true;
    void (async () => {
      setLoading(true); setError(null);
      try {
        const viewer = await getLibraryViewer();
        if (!canEditSource(viewer)) throw new Error("Library editor access is required to review proposals.");
        const result = await load();
        if (active) { setRows(result.rows); setNextToken(result.nextToken); }
      } catch (caught) { if (active) setError(getErrorMessage(caught)); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [load]);

  const loadMore = async () => {
    if (!nextToken || loadingMore) return;
    setLoadingMore(true);
    try {
      const result = await load(nextToken);
      setRows((current) => [...current, ...result.rows]);
      setNextToken(result.nextToken);
    } catch (caught) { setError(getErrorMessage(caught)); }
    finally { setLoadingMore(false); }
  };

  const heading = period ? "Pending period proposals" : "All pending source proposals";
  return <div className="px-4 px-xl-5 pb-4">
    <LibrarySectionHeader
      title="LIBRARY"
      subtitle={null}
      period={period}
      rightContent={<Link className="btn btn-outline-dark btn-sm" to={admin ? "/library/admin" : `/library/period/${period}`}>Back</Link>}
    />
    <div className="d-flex justify-content-between align-items-center gap-3 mb-4 flex-wrap">
      <h1 className="h3 mb-0">{heading}</h1>
    </div>
    {error && <div className="tempvs-plain-message text-danger">{error}</div>}
    {loading && <Spinner />}
    {!loading && rows.length === 0 && <div className="tempvs-plain-message text-muted">No pending proposals.</div>}
    {!loading && rows.map(({ source, count }) => <div key={source.id} className="stash-shell p-3 mb-2 d-flex justify-content-between align-items-center gap-3">
      <Link to={`/library/source/${source.id}/proposals`} className="text-reset text-decoration-none"><strong>{source.name}</strong></Link>
      <span className="badge text-bg-dark rounded-pill">{count}</span>
    </div>)}
    {nextToken && <Button variant="outline-dark" disabled={loadingMore} onClick={() => void loadMore()}>{loadingMore ? "Loading…" : "Load more"}</Button>}
  </div>;
}
