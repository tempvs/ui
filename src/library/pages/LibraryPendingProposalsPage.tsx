import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, Form } from "react-bootstrap";
import { useIntl } from "react-intl";
import { Link, useParams } from "react-router-dom";

import Spinner from "../../component/Spinner";
import TextFilterInput from "../../component/TextFilterInput";
import { getErrorMessage } from "../../util/errors";
import SourceChangesetProposalCard from "../components/SourceChangesetProposalCard";
import {
  getLibraryViewer,
  getPendingSourceChangesets,
  getSourceChangesetImages,
  getSourceImages,
  type LibrarySourceImage,
  type PendingSourceChangeset,
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
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const [selectedClassification, setSelectedClassification] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [expandedChangesetIds, setExpandedChangesetIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [imagePreviewsByChangeset, setImagePreviewsByChangeset] = useState<Record<string, {
    published: LibrarySourceImage[];
    staged: LibrarySourceImage[];
  }>>({});
  const [loadingImagePreviewIds, setLoadingImagePreviewIds] = useState<Set<string>>(
    () => new Set(),
  );

  const sourceFilters = useMemo(
    () => ({
      query: query.trim() || undefined,
      period: period?.toUpperCase() || selectedPeriod || undefined,
      classification: selectedClassification || undefined,
      type: selectedType || undefined,
    }),
    [period, query, selectedClassification, selectedPeriod, selectedType],
  );

  const load = useCallback(async (token?: string) => {
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
  }, [sourceFilters]);

  useEffect(() => {
    let active = true;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const viewer = await getLibraryViewer();
        if (!canEditSource(viewer)) {
          throw new Error("Library editor access is required to review changesets.");
        }
        const result = await load();
        if (active) {
          setRows(result.rows);
          setNextToken(result.nextToken);
          setExpandedChangesetIds(new Set());
          setImagePreviewsByChangeset({});
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

  const toggleChangeset = async (row: PendingSourceChangeset) => {
    const { source, changeset } = row;
    const isExpanded = expandedChangesetIds.has(changeset.id);
    setExpandedChangesetIds((current) => {
      const next = new Set(current);
      if (next.has(changeset.id)) next.delete(changeset.id);
      else next.add(changeset.id);
      return next;
    });
    if (isExpanded || !changeset.imageOperations.length || imagePreviewsByChangeset[changeset.id]) {
      return;
    }
    setLoadingImagePreviewIds((current) => new Set(current).add(changeset.id));
    try {
      const needsStagedImages = changeset.imageOperations.some(
        (operation) => operation.kind === "ADD" || operation.kind === "REPLACE",
      );
      const [published, staged] = await Promise.all([
        getSourceImages(source.id).catch(() => null),
        needsStagedImages
          ? getSourceChangesetImages(source.id, changeset.id).catch(() => null)
          : Promise.resolve(null),
      ]);
      setImagePreviewsByChangeset((current) => ({
        ...current,
        [changeset.id]: {
          published: published?.data || [],
          staged: staged?.data || [],
        },
      }));
    } finally {
      setLoadingImagePreviewIds((current) => {
        const next = new Set(current);
        next.delete(changeset.id);
        return next;
      });
    }
  };

  const heading = period ? "Pending period changesets" : "All pending source changesets";
  return <>
    <div className="d-flex justify-content-between align-items-center gap-3 mb-4 flex-wrap">
      <h1 className="h3 mb-0">{heading}</h1>
    </div>
    <div className="d-flex align-items-center gap-2 flex-wrap mb-4">
      <div style={{ minWidth: "15rem", flex: "1 1 18rem" }}>
        <TextFilterInput
          ariaLabel="Filter pending source changesets"
          placeholder="Filter by source name"
          value={query}
          onChange={setQuery}
        />
      </div>
      {!period && (
        <Form.Select
          aria-label="Filter pending changesets by period"
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
    {!loading && rows.length === 0 && <div className="tempvs-plain-message text-muted">No pending changesets.</div>}
    {!loading && rows.map((row) => {
      const { source, changeset } = row;
      return <SourceChangesetProposalCard
        key={changeset.id}
        source={source}
        changeset={changeset}
        expanded={expandedChangesetIds.has(changeset.id)}
        onToggle={() => void toggleChangeset(row)}
        loadingImagePreviews={loadingImagePreviewIds.has(changeset.id)}
        imagePreviews={imagePreviewsByChangeset[changeset.id]}
        context={<div className="d-flex align-items-center gap-2 flex-wrap text-muted small mt-1">
          {source.period && <Badge bg="light" text="dark" className="border">{getPeriodLabel(intl, source.period)}</Badge>}
          {source.type && <Badge bg="info">{getTypeLabel(intl, source.type)}</Badge>}
          {source.classification && <Badge bg="secondary">{getClassificationLabel(intl, source.classification)}</Badge>}
        </div>}
      />;
    })}
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
