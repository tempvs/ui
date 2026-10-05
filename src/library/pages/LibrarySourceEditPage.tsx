import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Form, Modal } from "react-bootstrap";
import { Link, useNavigate, useParams } from "react-router-dom";

import PageLayout from "../../component/PageLayout";
import Spinner from "../../component/Spinner";
import { type HistoricalYearInput } from "../../component/HistoricalRangeFilter";
import { getErrorMessage } from "../../util/errors";
import { PERIODS } from "../../util/periods";
import LibraryPeriodBreadcrumb from "../components/LibraryPeriodBreadcrumb";
import SourceChangesetDiff from "../components/SourceChangesetDiff";
import {
  amendSourceChangeset,
  createSourceChangeset,
  getLibraryViewer,
  getSource,
  getSourceChangesets,
  type LibrarySource,
  type SourceChangeset,
  type SourceChangesetSnapshot,
} from "../libraryApi";
import { CLASSIFICATIONS, TYPES } from "../libraryShared";
import { canEditSource } from "../libraryRoles";

type Draft = {
  name: string;
  description: string;
  period: string;
  classification: string;
  type: string;
  from: HistoricalYearInput;
  to: HistoricalYearInput;
};

function asDraft(source: LibrarySource): Draft {
  return {
    name: source.name || "",
    description: source.description || "",
    period: source.period || "",
    classification: source.classification || "",
    type: source.type || "",
    from: { year: source.from ? String(source.from.year) : "", era: source.from?.era || "AD" },
    to: { year: source.to ? String(source.to.year) : "", era: source.to?.era || "AD" },
  };
}

function snapshot(draft: Draft): SourceChangesetSnapshot {
  return {
    name: draft.name.trim(),
    description: draft.description.trim() || null,
    period: draft.period as SourceChangesetSnapshot["period"],
    classification: draft.classification as SourceChangesetSnapshot["classification"],
    type: draft.type as SourceChangesetSnapshot["type"],
    from: draft.from.year ? { year: Number(draft.from.year), era: draft.from.era } : null,
    to: draft.to.year ? { year: Number(draft.to.year), era: draft.to.era } : null,
  };
}

function isRangeValid(draft: Draft) {
  const from = snapshot(draft).from;
  const to = snapshot(draft).to;
  if (!from || !to) return true;
  const ordinal = (value: NonNullable<typeof from>) =>
    value.era === "BC" ? -value.year : value.year;
  return ordinal(from) <= ordinal(to);
}

/** Explicit source edit flow. It deliberately creates one reviewable changeset. */
export default function LibrarySourceEditPage() {
  const { sourceId } = useParams();
  const navigate = useNavigate();
  const [source, setSource] = useState<LibrarySource | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [ownPending, setOwnPending] = useState<SourceChangeset | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sourceResult, viewer, changesetsResult] = await Promise.all([
        getSource(sourceId),
        getLibraryViewer(),
        getSourceChangesets(sourceId).catch(() => null),
      ]);
      if (!sourceResult.ok || !sourceResult.data) throw new Error("Unable to load the source.");
      if (!canEditSource(viewer)) throw new Error("Library editor access is required to edit a source.");
      setSource(sourceResult.data);
      setDraft(asDraft(sourceResult.data));
      const ownUserId = viewer?.userId;
      setOwnPending(
        changesetsResult?.data?.content.find(
          (changeset) => changeset.status === "PENDING" && changeset.proposerId === ownUserId,
        ) || null,
      );
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [sourceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const proposed = useMemo(() => (draft ? snapshot(draft) : null), [draft]);
  const canReview = Boolean(
    source &&
      proposed &&
      proposed.name &&
      proposed.period &&
      proposed.classification &&
      proposed.type &&
      isRangeValid(draft!),
  );

  const update = <K extends keyof Draft>(field: K, value: Draft[K]) => {
    setDraft((current) => (current ? { ...current, [field]: value } : current));
  };

  const submit = async () => {
    if (!source || !proposed || !canReview) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = ownPending
        ? await amendSourceChangeset(sourceId, ownPending.id, { proposed }, ownPending.version)
        : await createSourceChangeset(sourceId, { proposed }, source.version);
      if (!result.ok) throw new Error("Unable to submit the source changeset.");
      const changeset = result.data as SourceChangeset;
      setShowReview(false);
      navigate(`/library/source/${source.id}/changesets/${changeset.id}`, { replace: true });
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <PageLayout header={{ title: "LIBRARY" }}><Spinner /></PageLayout>;
  if (!source || !draft || !proposed) {
    return <PageLayout header={{ title: "LIBRARY" }}><div className="tempvs-plain-message text-danger">{error || "Source not found."}</div></PageLayout>;
  }

  return (
    <PageLayout
      header={{
        title: "EDIT SOURCE",
        backgroundColor: "#f3efe4",
        borderColor: "#d9ccb0",
        rightContent: <div className="d-flex align-items-center gap-2"><LibraryPeriodBreadcrumb period={source.period} trailingItem={{ label: source.name, to: `/library/source/${source.id}` }} /><Link to={`/library/source/${source.id}`} className="btn btn-outline-dark btn-sm">Cancel</Link></div>,
      }}
    >
      <div className="page-layout-content px-4 px-xl-5 pb-4">
        <div className="stash-shell p-3 p-md-4 mx-auto" style={{ maxWidth: "52rem" }}>
          <h1 className="h3 mb-1">Propose source changes</h1>
          <p className="text-muted mb-4">Your edits will be reviewed before they change the published source.</p>
          {ownPending && <div className="alert alert-warning small">You have a pending changeset. Submitting this form will amend that changeset.</div>}
          {error && <div className="alert alert-danger" role="alert">{error}</div>}
          <Form onSubmit={(event) => { event.preventDefault(); if (canReview) setShowReview(true); }}>
            <Form.Group className="mb-3"><Form.Label>Name</Form.Label><Form.Control required value={draft.name} onChange={(event) => update("name", event.target.value)} /></Form.Group>
            <Form.Group className="mb-3"><Form.Label>Description</Form.Label><Form.Control as="textarea" rows={5} value={draft.description} onChange={(event) => update("description", event.target.value)} /></Form.Group>
            <div className="row g-3 mb-3">
              <Form.Group className="col-md-4"><Form.Label>Period</Form.Label><Form.Select required value={draft.period} onChange={(event) => update("period", event.target.value)}><option value="">Choose period</option>{PERIODS.map((period) => <option key={period} value={period}>{period.replaceAll("_", " ")}</option>)}</Form.Select></Form.Group>
              <Form.Group className="col-md-4"><Form.Label>Classification</Form.Label><Form.Select required value={draft.classification} onChange={(event) => update("classification", event.target.value)}><option value="">Choose classification</option>{CLASSIFICATIONS.map((value) => <option key={value} value={value}>{value}</option>)}</Form.Select></Form.Group>
              <Form.Group className="col-md-4"><Form.Label>Type</Form.Label><Form.Select required value={draft.type} onChange={(event) => update("type", event.target.value)}><option value="">Choose type</option>{TYPES.map((value) => <option key={value} value={value}>{value}</option>)}</Form.Select></Form.Group>
            </div>
            <fieldset className="border rounded p-3 mb-4"><legend className="float-none w-auto px-2 fs-6 mb-0">Years</legend><div className="row g-3"><Form.Group className="col-sm-6"><Form.Label>From</Form.Label><div className="d-flex gap-2"><Form.Control inputMode="numeric" maxLength={4} value={draft.from.year} onChange={(event) => update("from", { ...draft.from, year: event.target.value.replace(/\D/g, "") })} /><Form.Select value={draft.from.era} onChange={(event) => update("from", { ...draft.from, era: event.target.value as "AD" | "BC" })}><option value="AD">AD</option><option value="BC">BC</option></Form.Select></div></Form.Group><Form.Group className="col-sm-6"><Form.Label>To</Form.Label><div className="d-flex gap-2"><Form.Control inputMode="numeric" maxLength={4} value={draft.to.year} onChange={(event) => update("to", { ...draft.to, year: event.target.value.replace(/\D/g, "") })} /><Form.Select value={draft.to.era} onChange={(event) => update("to", { ...draft.to, era: event.target.value as "AD" | "BC" })}><option value="AD">AD</option><option value="BC">BC</option></Form.Select></div></Form.Group></div>{!isRangeValid(draft) && <div className="text-danger small mt-2">From cannot be later than To.</div>}</fieldset>
            <div className="d-flex justify-content-end gap-2"><Link to={`/library/source/${source.id}`} className="btn btn-outline-secondary">Cancel</Link><Button type="submit" variant="dark" disabled={!canReview}>Review changes</Button></div>
          </Form>
        </div>
      </div>
      <Modal show={showReview} onHide={() => !submitting && setShowReview(false)} size="lg" centered>
        <Modal.Header closeButton><Modal.Title>Review changes</Modal.Title></Modal.Header>
        <Modal.Body><p className="text-muted">The published source will stay unchanged until another Library editor approves this changeset.</p><SourceChangesetDiff base={{ name: source.name || "", description: source.description || null, period: source.period || null, classification: source.classification || null, type: source.type || null, from: source.from || null, to: source.to || null }} proposed={proposed} /></Modal.Body>
        <Modal.Footer><Button variant="outline-secondary" disabled={submitting} onClick={() => setShowReview(false)}>Back to editing</Button><Button variant="dark" disabled={submitting} onClick={() => void submit()}>{submitting ? "Submitting…" : ownPending ? "Amend changeset" : "Propose changes"}</Button></Modal.Footer>
      </Modal>
    </PageLayout>
  );
}
