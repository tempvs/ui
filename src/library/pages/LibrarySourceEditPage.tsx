import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Form, Modal } from "react-bootstrap";
import { useIntl } from "react-intl";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import PageLayout from "../../component/PageLayout";
import ConfirmationModal from "../../component/ConfirmationModal";
import Spinner from "../../component/Spinner";
import StackedImageGallery, {
  type GalleryImage,
} from "../../component/StackedImageGallery";
import PlacePickerField from "../../component/PlacePickerField";
import type { MapPlace } from "../../map/mapApi";
import { type HistoricalYearInput } from "../../component/HistoricalRangeFilter";
import { getErrorMessage } from "../../util/errors";
import { prepareImageFile } from "../../util/fileUtils";
import { getPeriodLabel, getPeriodOptionLabel, PERIODS } from "../../util/periods";
import OptionLabelSelect from "../../component/OptionLabelSelect";
import LibraryPeriodBreadcrumb from "../components/LibraryPeriodBreadcrumb";
import SourceChangesetDiff from "../components/SourceChangesetDiff";
import {
  amendSourceChangeset,
  createSourceChangeset,
  getLibraryViewer,
  getSource,
  getSourceImages,
  getSourceChangesets,
  getSourceChangeset,
  proposeSourceDeletion,
  rebaseSourceChangeset,
  uploadSourceChangesetImage,
  type LibrarySourceImage,
  type LibrarySource,
  type SourceChangeset,
  type SourceImageOperation,
  type SourceChangesetSnapshot,
} from "../libraryApi";
import { TYPES } from "../libraryShared";
import { canEditSource } from "../libraryRoles";
import { LibraryHint } from "../onboarding/LibraryJourney";

type Draft = {
  name: string;
  description: string;
  period: string;
  type: string;
  from: HistoricalYearInput;
  to: HistoricalYearInput;
  discoveredAtPlaceId: string | null;
  discoveredAtPlaceName: string;
  heldAtPlaceId: string | null;
  heldAtPlaceName: string;
};

type PendingImage = {
  id: string;
  file: File;
  previewUrl: string;
  description: string;
  replacementFor?: string;
};

function responseError(
  response: { status: number; data: unknown },
  fallback: string,
): Error {
  const message =
    response.data &&
    typeof response.data === "object" &&
    "message" in response.data &&
    typeof response.data.message === "string"
      ? response.data.message
      : fallback;
  return new Error(message);
}

function asDraft(source: LibrarySource): Draft {
  return {
    name: source.name || "",
    description: source.description || "",
    period: source.period || "",
    type: source.type || "",
    from: {
      year: source.from ? String(source.from.year) : "",
      era: source.from?.era || "AD",
    },
    to: {
      year: source.to ? String(source.to.year) : "",
      era: source.to?.era || "AD",
    },
    discoveredAtPlaceId: source.discoveredAtPlaceId || null,
    discoveredAtPlaceName: source.discoveredAtPlaceName || "",
    heldAtPlaceId: source.heldAtPlaceId || null,
    heldAtPlaceName: source.heldAtPlaceName || "",
  };
}

function asDraftSnapshot(source: SourceChangesetSnapshot): Draft {
  return {
    name: source.name || "",
    description: source.description || "",
    period: source.period || "",
    type: source.type || "",
    from: {
      year: source.from ? String(source.from.year) : "",
      era: source.from?.era || "AD",
    },
    to: {
      year: source.to ? String(source.to.year) : "",
      era: source.to?.era || "AD",
    },
    discoveredAtPlaceId: source.discoveredAtPlaceId || null,
    discoveredAtPlaceName: source.discoveredAtPlaceName || "",
    heldAtPlaceId: source.heldAtPlaceId || null,
    heldAtPlaceName: source.heldAtPlaceName || "",
  };
}

function snapshot(draft: Draft): SourceChangesetSnapshot {
  return {
    name: draft.name.trim(),
    description: draft.description.trim() || null,
    period: draft.period as SourceChangesetSnapshot["period"],
    type: draft.type as SourceChangesetSnapshot["type"],
    from: draft.from.year
      ? { year: Number(draft.from.year), era: draft.from.era }
      : null,
    to: draft.to.year
      ? { year: Number(draft.to.year), era: draft.to.era }
      : null,
    discoveredAtPlaceId: draft.discoveredAtPlaceId,
    discoveredAtPlaceName: draft.discoveredAtPlaceName || null,
    heldAtPlaceId: draft.heldAtPlaceId,
    heldAtPlaceName: draft.heldAtPlaceName || null,
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

export default function LibrarySourceEditPage() {
  const { sourceId } = useParams();
  const [searchParams] = useSearchParams();
  const selectedChangesetId = searchParams.get("changeset");
  return (
    <LibrarySourceEditor
      key={`${sourceId}:${selectedChangesetId}`}
      sourceId={sourceId}
      selectedChangesetId={selectedChangesetId}
    />
  );
}

type InlineEditor = {
  source: LibrarySource;
  changeset: SourceChangeset;
  publishedImages: LibrarySourceImage[];
  stagedImages: LibrarySourceImage[];
  canRebase: boolean;
  onCancel: () => void;
  onSaved: (changeset: SourceChangeset) => void;
};

export function LibrarySourceEditor({
  sourceId,
  selectedChangesetId,
  inline,
}: {
  sourceId?: string;
  selectedChangesetId?: string | null;
  inline?: InlineEditor;
}) {
  const intl = useIntl();
  const navigate = useNavigate();
  const [source, setSource] = useState<LibrarySource | null>(inline?.source ?? null);
  const [draft, setDraft] = useState<Draft | null>(() =>
    inline ? asDraftSnapshot(inline.changeset.proposed) : null,
  );
  const [ownPending, setOwnPending] = useState<SourceChangeset | null>(
    inline?.changeset ?? null,
  );
  const [isUnpublishedCreation, setIsUnpublishedCreation] = useState(false);
  const [otherPendingCount, setOtherPendingCount] = useState(0);
  const [loading, setLoading] = useState(!inline);
  const [submitting, setSubmitting] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [images, setImages] = useState<LibrarySourceImage[]>(inline?.publishedImages ?? []);
  const [imageOperations, setImageOperations] = useState<
    SourceImageOperation[]
  >(inline?.changeset.imageOperations ?? []);
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [savedRevision, setSavedRevision] = useState<SourceChangeset | null>(null);
  const uploadsComplete = useRef(new Set<string>());
  const [preparingImages, setPreparingImages] = useState(0);
  const [replacementImageId, setReplacementImageId] = useState<
    string | undefined
  >();
  const previewUrls = useRef(new Set<string>());
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(
    () => () => previewUrls.current.forEach((url) => URL.revokeObjectURL(url)),
    [],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sourceResult, viewer, changesetsResult, imageResult] =
        await Promise.all([
          getSource(sourceId),
          getLibraryViewer(),
          getSourceChangesets(sourceId).catch(() => null),
          getSourceImages(sourceId).catch(() => null),
        ]);
      if (!canEditSource(viewer))
        throw new Error("Library editor access is required to edit a source.");
      if (changesetsResult && !changesetsResult.ok)
        throw responseError(
          changesetsResult,
          "Unable to load source changesets.",
        );
      const changesets = changesetsResult?.data?.content || [];
      if (
        selectedChangesetId &&
        !changesets.some((changeset) => changeset.id === selectedChangesetId)
      ) {
        const selected = await getSourceChangeset(
          sourceId,
          selectedChangesetId,
        );
        if (!selected.ok || !selected.data || !("changeset" in selected.data))
          throw new Error("Unable to load the selected proposal.");
        changesets.push(selected.data.changeset);
      }
      const pendingCreation = changesets.find(
        (changeset) =>
          changeset.kind === "CREATE" &&
          (changeset.status === "PENDING" || changeset.status === "APPROVED"),
      );
      // A creation proposal has no public source projection yet. The review
      // API still exposes its immutable snapshot to Library editors, which is
      // the authoritative base for an amendment.
      const editableSource =
        sourceResult.ok && sourceResult.data
          ? sourceResult.data
          : pendingCreation
            ? {
                id: sourceId || pendingCreation.sourceId,
                version: pendingCreation.baseVersion,
                ...pendingCreation.proposed,
              }
            : null;
      if (!editableSource) throw new Error("Unable to load the source.");
      setSource(editableSource);
      setIsUnpublishedCreation(Boolean(pendingCreation && !sourceResult.ok));
      setImages(sourceResult.ok ? imageResult?.data || [] : []);
      const ownUserId = viewer?.userId;
      const pending =
        changesets.find(
          (changeset) =>
            (changeset.status === "PENDING" ||
              changeset.status === "APPROVED") &&
            (selectedChangesetId
              ? changeset.id === selectedChangesetId
              : changeset.proposerId === ownUserId),
        ) || null;
      setOwnPending(pending);
      if (pending?.kind === "DELETE") {
        navigate(
          `/library/source/${editableSource.id}/changesets/${pending.id}`,
          { replace: true },
        );
        return;
      }
      setDraft(
        pending ? asDraftSnapshot(pending.proposed) : asDraft(editableSource),
      );
      setOtherPendingCount(
        changesets.filter(
          (changeset) =>
            changeset.status === "PENDING" &&
            changeset.proposerId !== ownUserId,
        ).length,
      );
      setImageOperations(pending?.imageOperations || []);
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [navigate, sourceId, selectedChangesetId]);

  const isInline = Boolean(inline);
  useEffect(() => {
    if (!isInline) void load();
  }, [isInline, load]);

  const proposed = useMemo(() => (draft ? snapshot(draft) : null), [draft]);
  const needsRebase = Boolean(ownPending && ownPending.baseVersion !== source?.version);
  const canReview = Boolean(
    source &&
    proposed &&
    proposed.name &&
    proposed.period &&
    proposed.type &&
    isRangeValid(draft!) &&
    (!inline || !needsRebase),
  );
  const hasChanges = !inline || (
    JSON.stringify(proposed) !== JSON.stringify(snapshot(asDraftSnapshot(inline.changeset.proposed))) ||
    JSON.stringify(imageOperations) !== JSON.stringify(inline.changeset.imageOperations)
  );

  const update = <K extends keyof Draft>(field: K, value: Draft[K]) => {
    setDraft((current) => (current ? { ...current, [field]: value } : current));
  };

  const addPendingImage = async (
    event: React.ChangeEvent<HTMLInputElement>,
    replacementFor?: string,
  ) => {
    const original = event.target.files?.[0];
    event.target.value = "";
    if (!original) return;
    setPreparingImages((count) => count + 1);
    try {
      const file = await prepareImageFile(original);
      const id = crypto.randomUUID();
      const previewUrl = URL.createObjectURL(file);
      previewUrls.current.add(previewUrl);
      setPendingImages((current) => {
        const superseded = replacementFor
          ? current.filter((image) => image.replacementFor === replacementFor)
          : [];
        superseded.forEach((image) => {
          URL.revokeObjectURL(image.previewUrl);
          previewUrls.current.delete(image.previewUrl);
        });
        return [
          ...(replacementFor
            ? current.filter((image) => image.replacementFor !== replacementFor)
            : current),
          {
            id,
            file,
            previewUrl,
            description: "",
            ...(replacementFor ? { replacementFor } : {}),
          },
        ];
      });
      setImageOperations((current) => [
        ...current.filter((operation) => {
          if (
            operation.kind === "REPLACE" &&
            operation.imageId === replacementFor
          )
            return false;
          return (
            operation.kind !== "UPDATE_DESCRIPTION" ||
            operation.imageId !== replacementFor
          );
        }),
        replacementFor
          ? {
              kind: "REPLACE",
              imageId: replacementFor,
              stagedImageId: id,
              description: null,
            }
          : { kind: "ADD", stagedImageId: id, description: null },
      ]);
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setPreparingImages((count) => count - 1);
    }
  };

  const removePublishedImage = (imageId: string) => {
    setPendingImages((current) => {
      current
        .filter((image) => image.replacementFor === imageId)
        .forEach((image) => {
          URL.revokeObjectURL(image.previewUrl);
          previewUrls.current.delete(image.previewUrl);
        });
      return current.filter((image) => image.replacementFor !== imageId);
    });
    setImageOperations((current) => [
      ...current.filter(
        (operation) =>
          !(
            operation.kind === "REMOVE" ||
            operation.kind === "REPLACE" ||
            operation.kind === "UPDATE_DESCRIPTION"
          ) || operation.imageId !== imageId,
      ),
      { kind: "REMOVE", imageId },
    ]);
  };

  const updatePendingDescription = (id: string, description: string) => {
    setPendingImages((current) =>
      current.map((image) =>
        image.id === id ? { ...image, description } : image,
      ),
    );
    setImageOperations((current) =>
      current.map((operation) => {
        if (operation.kind === "ADD" && operation.stagedImageId === id)
          return { ...operation, description: description || null };
        if (operation.kind === "REPLACE" && operation.stagedImageId === id)
          return { ...operation, description: description || null };
        return operation;
      }),
    );
  };

  const removePendingImage = (id: string) => {
    setPendingImages((current) => {
      const removed = current.find((image) => image.id === id);
      if (removed) {
        URL.revokeObjectURL(removed.previewUrl);
        previewUrls.current.delete(removed.previewUrl);
      }
      return current.filter((image) => image.id !== id);
    });
    setImageOperations((current) =>
      current.filter(
        (operation) =>
          !(operation.kind === "ADD" || operation.kind === "REPLACE") ||
          operation.stagedImageId !== id,
      ),
    );
  };

  const updatePublishedDescription = (imageId: string, description: string) => {
    const publishedDescription =
      images.find((image) => image.id === imageId)?.description || "";
    setImageOperations((current) => {
      const withoutDescription = current.filter(
        (operation) =>
          operation.kind !== "UPDATE_DESCRIPTION" ||
          operation.imageId !== imageId,
      );
      return description === publishedDescription
        ? withoutDescription
        : [
            ...withoutDescription,
            {
              kind: "UPDATE_DESCRIPTION",
              imageId,
              description: description || null,
            },
          ];
    });
  };

  const selectImage = (event: React.ChangeEvent<HTMLInputElement>) => {
    const replacementFor = replacementImageId;
    setReplacementImageId(undefined);
    void addPendingImage(event, replacementFor);
  };

  const submit = async () => {
    if (!source || !proposed || submitting || preparingImages ||
      (!savedRevision && (!canReview || !hasChanges))) return;
    setSubmitting(true);
    setError(null);
    try {
      let changeset = savedRevision;
      if (!changeset) {
        const payload = { proposed, imageOperations };
        const result = ownPending
          ? await amendSourceChangeset(source.id, ownPending.id, payload, ownPending.version)
          : await createSourceChangeset(source.id, payload, source.version);
        if (!result.ok || !result.data)
          throw responseError(result, "Unable to submit the source changeset.");
        if ("changeset" in result.data) changeset = result.data.changeset;
        else if ("proposed" in result.data) changeset = result.data;
        else throw new Error("The server did not return the saved proposal.");
        setSavedRevision(changeset);
      }
      for (const image of pendingImages) {
        if (uploadsComplete.current.has(image.id)) continue;
        const upload = await uploadSourceChangesetImage(
          source.id,
          changeset.id,
          image.id,
          image.file,
          image.description || null,
        );
        if (!upload.ok)
          throw new Error(
            "The revision was saved. Retry to finish uploading its images.",
          );
        uploadsComplete.current.add(image.id);
      }
      setShowReview(false);
      if (inline) inline.onSaved(changeset);
      else navigate(`/library/source/${source.id}/changesets/${changeset.id}`, { replace: true });
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  };

  const proposeDeletion = async () => {
    if (!source) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await proposeSourceDeletion(source.id, source.version);
      if (
        !result.ok ||
        !result.data ||
        typeof result.data !== "object" ||
        !("id" in result.data)
      )
        throw responseError(result, "Unable to create the deletion changeset.");
      setShowDeleteConfirmation(false);
      navigate(
        `/library/source/${source.id}/changesets/${String(result.data.id)}`,
      );
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  };

  const rebase = async () => {
    if (!source || !ownPending) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await rebaseSourceChangeset(
        source.id,
        ownPending.id,
        ownPending.version,
      );
      if (!result.ok || !result.data || !("id" in result.data))
        throw responseError(result, "Unable to rebase this changeset.");
      const rebased = result.data as SourceChangeset;
      if (inline) {
        inline.onSaved(rebased);
        return;
      }
      setOwnPending(rebased);
      setDraft(asDraftSnapshot(rebased.proposed));
      setImageOperations(rebased.imageOperations || []);
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading)
    return (
      <PageLayout header={{ title: "LIBRARY" }}>
        <Spinner />
      </PageLayout>
    );
  if (!source || !draft || !proposed) {
    return (
      <PageLayout header={{ title: "LIBRARY" }}>
        <div className="tempvs-plain-message text-danger">
          {error || "Source not found."}
        </div>
      </PageLayout>
    );
  }

  const header = {
    title: (
      <LibraryPeriodBreadcrumb
        period={source.period}
        trailingItem={{
          label: source.name,
          to:
            isUnpublishedCreation && ownPending
              ? `/library/source/${source.id}/changesets/${ownPending.id}`
              : `/library/source/${source.id}`,
        }}
        trailingItems={[
          ...(ownPending
            ? [
                {
                  label: "Proposal",
                  to: `/library/source/${source.id}/changesets/${ownPending.id}`,
                },
              ]
            : []),
          { label: ownPending ? "Edit proposal" : "Propose changes" },
        ]}
      />
    ),
    backgroundColor: "#f3efe4",
    borderColor: "#d9ccb0",
    rightContent: !isUnpublishedCreation ? (
      <Button
        type="button"
        size="sm"
        variant="outline-danger"
        disabled={submitting}
        onClick={() => setShowDeleteConfirmation(true)}
      >
        Delete source
      </Button>
    ) : null,
  };
  const diff = (
    <SourceChangesetDiff
      base={inline && ownPending ? ownPending.base : snapshot(asDraft(source))}
      proposed={proposed}
      kind={inline ? ownPending?.kind : undefined}
      imageOperations={imageOperations}
      imagePreviews={{
        published: images,
        staged: [
          ...(inline?.stagedImages ?? []),
          ...pendingImages.map((image) => ({
            id: image.id,
            url: image.previewUrl,
            fileName: image.file.name,
            description: image.description || null,
          })),
        ],
      }}
    />
  );
  const content = (
    <>
      <div
        className={inline ? "proposal-editor" : "stash-shell p-3 p-md-4 mx-auto"}
        style={inline ? undefined : { maxWidth: "52rem" }}
      >
        {inline ? <h3 className="h5 mb-3">Edit proposal</h3> : <>
        <h1 className="h3 mb-1">Propose source changes</h1>
        <p className="text-muted mb-4">
          Your edits will be reviewed before they change the published source.
        </p>
        </>}
        {ownPending && (
          <div className="alert alert-warning small">
            {inline
              ? inline.changeset.status === "APPROVED"
                ? "Saving this revision requires a new approval."
                : "An independent reviewer will need to approve this revision."
              : "You are editing an existing proposal. Submitting this form will amend it and require a new approval."}
          </div>
        )}
        {needsRebase && (
          <div className="alert alert-warning small d-flex flex-wrap justify-content-between align-items-center gap-3">
            <span>
              {inline && !inline.canRebase
                ? "The published source changed. Ask the proposal author to rebase before editing."
                : "The published source changed. Rebase to carry forward the proposed changes that do not conflict."}
            </span>
            {(!inline || inline.canRebase) && <Button
              size="sm"
              variant="outline-dark"
              disabled={submitting || Boolean(savedRevision) || preparingImages > 0}
              onClick={() => void rebase()}
            >
              Rebase changes
            </Button>}
          </div>
        )}
        {otherPendingCount > 0 && (
          <div className="alert alert-info small">
            {otherPendingCount} pending proposal
            {otherPendingCount === 1 ? " is" : "s are"} from other editors.
            Your proposal is reviewed independently and cannot overwrite any
            approved changes.
          </div>
        )}
        {!inline && error && (
          <div className="alert alert-danger" role="alert">
            {error}
          </div>
        )}
        <Form
          onSubmit={(event) => {
            event.preventDefault();
            if (inline || savedRevision) void submit();
            else if (canReview) setShowReview(true);
          }}
        >
          <fieldset disabled={submitting || Boolean(savedRevision) || (isInline && needsRebase)}>
            <Form.Group className="mb-3" controlId="source-editor-name">
              <Form.Label>Name</Form.Label>
              <Form.Control
                required
                autoFocus={isInline}
                value={draft.name}
                onChange={(event) => update("name", event.target.value)}
              />
            </Form.Group>
            <Form.Group className="mb-3" controlId="source-editor-description">
              <Form.Label>Description</Form.Label>
              <Form.Control
                as="textarea"
                rows={5}
                value={draft.description}
                onChange={(event) => update("description", event.target.value)}
              />
            </Form.Group>
            <div className="row g-3 mb-3">
              <Form.Group className="col-sm-6" controlId="source-editor-period">
                <Form.Label>Period</Form.Label>
                <OptionLabelSelect
                  required
                  value={draft.period}
                  onChange={(event) => update("period", event.target.value)}
                  options={[
                    { value: "", label: "Choose period" },
                    ...PERIODS.map(period => ({ value: period, label: getPeriodOptionLabel(intl, period), readOnlyLabel: getPeriodLabel(intl, period) })),
                  ]}
                />
              </Form.Group>
              <Form.Group className="col-sm-6" controlId="source-editor-type">
                <Form.Label>Type</Form.Label>
                <Form.Select
                  required
                  value={draft.type}
                  onChange={(event) => update("type", event.target.value)}
                >
                  <option value="">Choose type</option>
                  {TYPES.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </div>
            <fieldset className="border rounded p-3 mb-4">
              <legend className="float-none w-auto px-2 fs-6 mb-0">
                Years
              </legend>
              <div className="row g-3">
                <Form.Group className="col-sm-6">
                  <Form.Label>From</Form.Label>
                  <div className="d-flex gap-2">
                    <Form.Control
                      aria-label="From year"
                      inputMode="numeric"
                      maxLength={4}
                      value={draft.from.year}
                      onChange={(event) =>
                        update("from", {
                          ...draft.from,
                          year: event.target.value.replace(/\D/g, ""),
                        })
                      }
                    />
                    <Form.Select
                      aria-label="From era"
                      value={draft.from.era}
                      onChange={(event) =>
                        update("from", {
                          ...draft.from,
                          era: event.target.value as "AD" | "BC",
                        })
                      }
                    >
                      <option value="AD">AD</option>
                      <option value="BC">BC</option>
                    </Form.Select>
                  </div>
                </Form.Group>
                <Form.Group className="col-sm-6">
                  <Form.Label>To</Form.Label>
                  <div className="d-flex gap-2">
                    <Form.Control
                      aria-label="To year"
                      inputMode="numeric"
                      maxLength={4}
                      value={draft.to.year}
                      onChange={(event) =>
                        update("to", {
                          ...draft.to,
                          year: event.target.value.replace(/\D/g, ""),
                        })
                      }
                    />
                    <Form.Select
                      aria-label="To era"
                      value={draft.to.era}
                      onChange={(event) =>
                        update("to", {
                          ...draft.to,
                          era: event.target.value as "AD" | "BC",
                        })
                      }
                    >
                      <option value="AD">AD</option>
                      <option value="BC">BC</option>
                    </Form.Select>
                  </div>
                </Form.Group>
              </div>
              {!isRangeValid(draft) && (
                <div className="text-danger small mt-2">
                  From cannot be later than To.
                </div>
              )}
            </fieldset>
            <fieldset className="border rounded p-3 mb-4">
              <legend className="float-none w-auto px-2 fs-6 mb-0">
                Places
              </legend>
              <PlacePickerField
                label="Discovered at"
                editable
                historicalRange={toMapRange(draft.from, draft.to)}
                value={
                  draft.discoveredAtPlaceId
                    ? {
                        id: draft.discoveredAtPlaceId,
                        canonicalName: draft.discoveredAtPlaceName,
                      }
                    : null
                }
                onChange={(place: MapPlace | null) => {
                  update("discoveredAtPlaceId", place?.id || null);
                  update(
                    "discoveredAtPlaceName",
                    place?.matchedName || place?.canonicalName || "",
                  );
                }}
              />
              <PlacePickerField
                label="Held at"
                editable
                historicalRange={toMapRange(draft.from, draft.to)}
                value={
                  draft.heldAtPlaceId
                    ? {
                        id: draft.heldAtPlaceId,
                        canonicalName: draft.heldAtPlaceName,
                      }
                    : null
                }
                onChange={(place: MapPlace | null) => {
                  update("heldAtPlaceId", place?.id || null);
                  update(
                    "heldAtPlaceName",
                    place?.matchedName || place?.canonicalName || "",
                  );
                }}
                className="mb-0"
              />
            </fieldset>
            <fieldset className="border rounded p-3 mb-4">
              <legend className="float-none w-auto px-2 fs-6 mb-0">
                Photo album
              </legend>
              <p className="small text-muted">
                Images are shown here for review. Changes stay private until the
                changeset is approved and published.
              </p>
              <Form.Control
                ref={imageInputRef}
                className="d-none"
                type="file"
                accept="image/jpeg,image/png,image/gif"
                onChange={selectImage}
              />
              <div className="row g-3 mb-3">
                {images.map((image) => {
                  const removed = imageOperations.some(
                    (operation) =>
                      operation.kind === "REMOVE" &&
                      operation.imageId === image.id,
                  );
                  const descriptionChange = imageOperations.find(
                    (operation) =>
                      operation.kind === "UPDATE_DESCRIPTION" &&
                      operation.imageId === image.id,
                  ) as
                    | Extract<
                        SourceImageOperation,
                        { kind: "UPDATE_DESCRIPTION" }
                      >
                    | undefined;
                  return (
                    <div className="col-md-6" key={image.id}>
                      <div
                        className={`source-edit-image-card border rounded p-2 h-100 ${removed ? "border-danger bg-danger-subtle" : ""}`}
                      >
                        <StackedImageGallery
                          mode="single"
                          title={image.fileName || "Source image"}
                          images={[image as GalleryImage]}
                          editable={!removed}
                          editableDescription={!removed}
                          showInlineDescription
                          imageDrafts={{
                            [image.id]:
                              descriptionChange?.description ??
                              image.description ??
                              "",
                          }}
                          onDescriptionChange={(_, description) =>
                            updatePublishedDescription(image.id, description)
                          }
                          onReplaceImage={() => {
                            setReplacementImageId(image.id);
                            imageInputRef.current?.click();
                          }}
                          onDeleteImage={() => removePublishedImage(image.id)}
                          previewStyle={{
                            height: "9rem",
                            objectFit: "contain",
                            backgroundColor: "#f8faf8",
                          }}
                        />
                        <div className="small fw-semibold text-truncate mt-2">
                          {image.fileName || "Image"}
                        </div>
                        {removed && (
                          <div className="small text-danger mt-1">
                            Marked for deletion
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                {pendingImages.map((image) => (
                  <div className="col-md-6" key={image.id}>
                    <div className="source-edit-image-card border border-success rounded p-2 h-100 bg-success-subtle">
                      <div className="small text-success fw-semibold mb-1">
                        {image.replacementFor ? "Replacement" : "New image"}
                      </div>
                      <StackedImageGallery
                        mode="single"
                        title={image.file.name}
                        images={[
                          {
                            id: image.id,
                            url: image.previewUrl,
                            fileName: image.file.name,
                          },
                        ]}
                        editable
                        showInlineDescription
                        imageDrafts={{ [image.id]: image.description }}
                        onDescriptionChange={(_, description) =>
                          updatePendingDescription(image.id, description)
                        }
                        onReplaceImage={() => {
                          setReplacementImageId(image.replacementFor);
                          imageInputRef.current?.click();
                        }}
                        onDeleteImage={() => removePendingImage(image.id)}
                        previewStyle={{
                          height: "9rem",
                          objectFit: "contain",
                          backgroundColor: "#f8faf8",
                        }}
                      />
                      <div className="small fw-semibold text-truncate mt-2">
                        {image.file.name}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline-dark"
                onClick={() => {
                  setReplacementImageId(undefined);
                  imageInputRef.current?.click();
                }}
              >
                Add image
              </Button>
            </fieldset>
          </fieldset>
          {inline && (
            <details className="mb-3">
              <summary className="fw-semibold">Preview revision</summary>
              {diff}
            </details>
          )}
          <div className={inline ? "proposal-decision" : "d-flex justify-content-end"}>
            {inline && error && <div className="text-danger small" role="alert">{error}</div>}
            {inline && (
              <Button
                type="button"
                variant="outline-secondary"
                onClick={inline.onCancel}
                disabled={submitting || Boolean(savedRevision)}
              >
                Cancel
              </Button>
            )}
            <LibraryHint
              topic="proposal"
              enabled={!inline && canReview && !showReview && !showDeleteConfirmation}
              message="Review the before-and-after changes, then submit your proposal for independent approval."
            >
              <Button
                type="submit"
                variant="dark"
                disabled={submitting || preparingImages > 0 || (!savedRevision && (!canReview || !hasChanges))}
              >
                {submitting ? "Saving…" : savedRevision ? "Retry image uploads" : inline ? "Save revision" : "Review changes"}
              </Button>
            </LibraryHint>
          </div>
        </Form>
      </div>
      <Modal
        show={showReview}
        onHide={() => !submitting && setShowReview(false)}
        size="lg"
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>Review changes</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="text-muted">
            The published source and its images will stay unchanged until
            another Library editor approves this changeset and you publish it.
          </p>
          {diff}
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="outline-secondary"
            disabled={submitting}
            onClick={() => setShowReview(false)}
          >
            Back to editing
          </Button>
          <Button
            variant="dark"
            disabled={submitting || preparingImages > 0}
            onClick={() => void submit()}
          >
            {submitting
              ? "Submitting…"
              : savedRevision
                ? "Retry image uploads"
              : ownPending
                ? "Amend changeset"
                : "Propose changes"}
          </Button>
        </Modal.Footer>
      </Modal>
      <ConfirmationModal
        show={showDeleteConfirmation}
        title="Delete source"
        message="Create a deletion changeset for review? The source remains visible until another Library editor approves it and you publish it."
        confirmLabel="Delete source"
        busy={submitting}
        onHide={() => !submitting && setShowDeleteConfirmation(false)}
        onConfirm={() => void proposeDeletion()}
      />
    </>
  );
  return inline ? content : <PageLayout header={header}>{content}</PageLayout>;
}

function toMapRange(from: HistoricalYearInput, to: HistoricalYearInput) {
  const astronomical = (value: HistoricalYearInput) => {
    if (!/^[1-9][0-9]*$/.test(value.year)) return undefined;
    const year = Number(value.year);
    return value.era === "BC" ? 1 - year : year;
  };
  const fromYear = astronomical(from);
  const toYear = astronomical(to);
  return {
    ...(fromYear !== undefined ? { from: fromYear } : {}),
    ...(toYear !== undefined ? { to: toYear } : {}),
  };
}
