import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Col, Form, Modal, Row } from "react-bootstrap";
import { useIntl } from "react-intl";
import { Link, useNavigate, useParams } from "react-router-dom";

import PlusActionButton from "../../component/PlusActionButton";
import CatalogueFilterDisclosure from "../../component/CatalogueFilterDisclosure";
import HistoricalRangeFilter, {
  type HistoricalYearInput,
} from "../../component/HistoricalRangeFilter";
import MultiImageFilePicker from "../../component/MultiImageFilePicker";
import PlacePickerField from "../../component/PlacePickerField";
import ResultSortSelect from "../../component/ResultSortSelect";
import TextFilterInput from "../../component/TextFilterInput";
import type { MapPlace } from "../../map/mapApi";
import { getErrorMessage } from "../../util/errors";
import { prepareImageFile } from "../../util/fileUtils";
import {
  amendSourceChangeset,
  createSource,
  findSources,
  getSourceImages,
  getSourceProposals,
  getLibraryViewer,
  LibrarySource,
  LibrarySourceImage,
  uploadSourceChangesetImage,
} from "../libraryApi";
import LibraryPeriodBreadcrumb from "../components/LibraryPeriodBreadcrumb";
import LibrarySectionHeader from "../components/LibrarySectionHeader";
import SourceCard from "../components/SourceCard";
import {
  getTypeLabel,
  PAGE_SIZE,
  TYPES,
} from "../libraryShared";
import { canContribute, canEditSource } from "../libraryRoles";
import { LibraryViewer } from "../libraryApi";
import { rangeFromInputs } from "../../search/publicSearchFilterContract";

export default function LibraryPeriodPage() {
  const { period } = useParams();
  const navigate = useNavigate();
  const intl = useIntl();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [userInfo, setUserInfo] = useState<LibraryViewer>(null);
  const [sources, setSources] = useState<LibrarySource[]>([]);
  const [nextToken, setNextToken] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sourcePreviewImages, setSourcePreviewImages] = useState<
    Record<string | number, LibrarySourceImage | null>
  >({});
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortOrder, setSortOrder] = useState<
    "NAME_ASC" | "NAME_DESC" | "YEAR_ASC" | "YEAR_DESC"
  >("NAME_ASC");
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [rangeEnabled, setRangeEnabled] = useState(false);
  const [from, setFrom] = useState<HistoricalYearInput>({
    year: "",
    era: "AD",
  });
  const [to, setTo] = useState<HistoricalYearInput>({ year: "", era: "AD" });
  const [discoveredAtPlace, setDiscoveredAtPlace] = useState<MapPlace | null>(
    null,
  );
  const [heldAtPlace, setHeldAtPlace] = useState<MapPlace | null>(null);
  const [draftSource, setDraftSource] = useState({
    name: "",
    description: "",
    type: "",
  });
  const [draftImages, setDraftImages] = useState<File[]>([]);
  const [draftFrom, setDraftFrom] = useState<HistoricalYearInput>({
    year: "",
    era: "AD",
  });
  const [draftTo, setDraftTo] = useState<HistoricalYearInput>({
    year: "",
    era: "AD",
  });
  const [draftDiscoveredAtPlace, setDraftDiscoveredAtPlace] =
    useState<MapPlace | null>(null);
  const [draftHeldAtPlace, setDraftHeldAtPlace] = useState<MapPlace | null>(
    null,
  );
  const [pendingProposalCount, setPendingProposalCount] = useState<
    number | null
  >(null);

  const periodCode = (period || "").toUpperCase();
  const sourceRange = useMemo(() => rangeFromInputs(from, to), [from, to]);
  const hasActiveFilters = Boolean(
    query.trim() ||
    selectedTypes.length ||
    (rangeEnabled && (from.year || to.year)) ||
    discoveredAtPlace ||
    heldAtPlace,
  );
  const sortedSources = useMemo(
    () =>
      [...sources].sort((left, right) => {
        if (sortOrder === "NAME_ASC" || sortOrder === "NAME_DESC") {
          const comparison = (left.name || "").localeCompare(
            right.name || "",
          );
          return sortOrder === "NAME_ASC" ? comparison : -comparison;
        }

        const leftYear = sourceSortYear(left);
        const rightYear = sourceSortYear(right);
        if (leftYear === null && rightYear === null) return 0;
        if (leftYear === null) return 1;
        if (rightYear === null) return -1;
        return sortOrder === "YEAR_ASC"
          ? leftYear - rightYear
          : rightYear - leftYear;
      }),
    [sources, sortOrder],
  );
  const clearFilters = () => {
    setQuery("");
    setSelectedTypes([]);
    setRangeEnabled(false);
    setFrom({ year: "", era: "AD" });
    setTo({ year: "", era: "AD" });
    setDiscoveredAtPlace(null);
    setHeldAtPlace(null);
  };

  const searchSources = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [result, viewer] = await Promise.all([
        findSources({
          query,
          period: periodCode,
          types: selectedTypes,
          ...(rangeEnabled && sourceRange.from
            ? { from: sourceRange.from }
            : {}),
          ...(rangeEnabled && sourceRange.to ? { to: sourceRange.to } : {}),
          ...(discoveredAtPlace
            ? {
                discoveredAtPlaceId: discoveredAtPlace.id,
                discoveredAtPlaceNames: placeSearchNames(discoveredAtPlace),
              }
            : {}),
          ...(heldAtPlace ? { heldAtPlaceId: heldAtPlace.id } : {}),
          page: 0,
          size: PAGE_SIZE,
        }),
        getLibraryViewer(),
      ]);

      if (!result.ok) {
        throw new Error("Unable to load sources for this period.");
      }

      const nextSources = Array.isArray(result.data) ? result.data : [];
      setSources(nextSources);
      setNextToken(result.nextToken);
      setSourcePreviewImages({});
      setUserInfo(viewer);

      const previewEntries = await Promise.all(
        nextSources.map(async (source) => {
          try {
            const imageResult = await getSourceImages(source.id);
            if (!imageResult.ok || !Array.isArray(imageResult.data)) {
              return [source.id, null] as const;
            }
            return [source.id, imageResult.data[0] || null] as const;
          } catch (previewError) {
            return [source.id, null] as const;
          }
        }),
      );
      setSourcePreviewImages(Object.fromEntries(previewEntries));
    } catch (fetchError) {
      setError(getErrorMessage(fetchError));
    } finally {
      setLoading(false);
    }
  }, [
    periodCode,
    query,
    selectedTypes,
    rangeEnabled,
    sourceRange,
    discoveredAtPlace,
    heldAtPlace,
  ]);

  const loadMoreSources = async () => {
    if (!nextToken || loadingMore) return;
    setLoadingMore(true);
    try {
      const result = await findSources({
        query,
        period: periodCode,
        types: selectedTypes,
        ...(rangeEnabled && sourceRange.from ? { from: sourceRange.from } : {}),
        ...(rangeEnabled && sourceRange.to ? { to: sourceRange.to } : {}),
        ...(discoveredAtPlace
          ? {
              discoveredAtPlaceId: discoveredAtPlace.id,
              discoveredAtPlaceNames: placeSearchNames(discoveredAtPlace),
            }
          : {}),
        ...(heldAtPlace ? { heldAtPlaceId: heldAtPlace.id } : {}),
        size: PAGE_SIZE,
        nextToken,
      });
      if (!result.ok) throw new Error("Unable to load more sources.");
      const nextSources = result.data || [];
      setSources((current) => [...current, ...nextSources]);
      setNextToken(result.nextToken);
      const previewEntries = await Promise.all(
        nextSources.map(async (source) => {
          try {
            const imageResult = await getSourceImages(source.id);
            return [
              source.id,
              imageResult.ok ? imageResult.data?.[0] || null : null,
            ] as const;
          } catch {
            return [source.id, null] as const;
          }
        }),
      );
      setSourcePreviewImages((current) => ({
        ...current,
        ...Object.fromEntries(previewEntries),
      }));
    } catch (fetchError) {
      setError(getErrorMessage(fetchError));
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      searchSources();
    }, 250);

    return () => window.clearTimeout(timerId);
  }, [searchSources]);

  const canReviewProposals = canEditSource(userInfo);
  useEffect(() => {
    if (!canReviewProposals) {
      setPendingProposalCount(null);
      return undefined;
    }

    let active = true;
    void (async () => {
      let nextPageToken: string | null | undefined;
      let count = 0;
      try {
        do {
          const result = await findSources({
            period: periodCode,
            size: PAGE_SIZE,
            nextToken: nextPageToken || undefined,
          });
          if (!result.ok) throw new Error("Unable to load pending proposals.");
          const proposalCounts = await Promise.all(
            (result.data || []).map(async (source) => {
              const proposals = await getSourceProposals(source.id);
              return proposals.ok ? (proposals.data || []).length : 0;
            }),
          );
          count += proposalCounts.reduce((total, value) => total + value, 0);
          nextPageToken = result.nextToken;
        } while (nextPageToken);
        if (active) setPendingProposalCount(count);
      } catch {
        if (active) setPendingProposalCount(null);
      }
    })();

    return () => {
      active = false;
    };
  }, [canReviewProposals, periodCode]);

  const handleToggle = (
    value: string,
    selectedValues: string[],
    setter: React.Dispatch<React.SetStateAction<string[]>>,
  ) => {
    setter(
      selectedValues.includes(value)
        ? selectedValues.filter((entry) => entry !== value)
        : [...selectedValues, value],
    );
  };

  const handleCreateSource: React.FormEventHandler<HTMLFormElement> = async (
    event,
  ) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const result = await createSource({
        ...draftSource,
        period: periodCode,
        ...(draftFrom.year
          ? { from: { year: Number(draftFrom.year), era: draftFrom.era } }
          : {}),
        ...(draftTo.year
          ? { to: { year: Number(draftTo.year), era: draftTo.era } }
          : {}),
        ...(draftDiscoveredAtPlace
          ? { discoveredAtPlaceId: draftDiscoveredAtPlace.id }
          : {}),
        ...(draftHeldAtPlace ? { heldAtPlaceId: draftHeldAtPlace.id } : {}),
      });

      if (!result.ok) {
        const message =
          result.data && "message" in result.data ? result.data.message : null;
        throw new Error(message || "Unable to create the source.");
      }

      if (
        !result.data ||
        !("source" in result.data) ||
        !("changeset" in result.data)
      ) {
        throw new Error("Unable to create the source.");
      }

      const created = result.data;
      if (draftImages.length) {
        const stagedImages = await Promise.all(
          draftImages.map(async (file) => ({
            id: crypto.randomUUID(),
            file: await prepareImageFile(file),
          })),
        );
        const amended = await amendSourceChangeset(
          created.source.id,
          created.changeset.id,
          {
            proposed: created.changeset.proposed,
            imageOperations: stagedImages.map((image) => ({
              kind: "ADD" as const,
              stagedImageId: image.id,
              description: null,
            })),
          },
          created.changeset.version,
        );
        if (!amended.ok) {
          throw new Error("Unable to add images to the source proposal.");
        }
        for (const image of stagedImages) {
          const upload = await uploadSourceChangesetImage(
            created.source.id,
            created.changeset.id,
            image.id,
            image.file,
            null,
          );
          if (!upload.ok) {
            throw new Error(
              "Unable to upload an image for the source proposal.",
            );
          }
        }
      }
      setDraftImages([]);
      setDraftDiscoveredAtPlace(null);
      setDraftHeldAtPlace(null);
      setShowCreateModal(false);
      navigate(
        `/library/source/${result.data.source.id}/changesets/${result.data.changeset.id}`,
      );
    } catch (fetchError) {
      setError(getErrorMessage(fetchError));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-layout-content px-4 px-xl-5 pb-4">
      <LibrarySectionHeader
        title="LIBRARY"
        subtitle={null}
        period={null}
        variant="period"
        middleContent={
          canReviewProposals ? (
            <Link
              className="btn btn-outline-dark btn-sm"
              to={`/library/period/${period}/proposals`}
            >
              Pending proposals
              {pendingProposalCount === null
                ? ""
                : ` (${pendingProposalCount})`}
            </Link>
          ) : null
        }
        rightContent={
          <LibraryPeriodBreadcrumb period={periodCode} variant="period" />
        }
      />
      {error && <div className="tempvs-plain-message text-danger">{error}</div>}

      <div className="catalogue-search-layout">
        <aside className="catalogue-search-filters">
          <CatalogueFilterDisclosure
            open={filtersOpen}
            onOpenChange={setFiltersOpen}
            hasActiveFilters={hasActiveFilters}
            inactiveSummary="All sources"
            onClearFilters={clearFilters}
            className="library-source-filter"
          >
            <HistoricalRangeFilter
              enabled={rangeEnabled}
              from={from}
              to={to}
              onEnabledChange={setRangeEnabled}
              onFromChange={setFrom}
              onToChange={setTo}
              alwaysShowFields
              onValueEntered={() => setRangeEnabled(true)}
            />
            <div>
              <PlacePickerField
                label="Discovered at"
                value={discoveredAtPlace}
                editable
                onChange={setDiscoveredAtPlace}
                labelWidth="7rem"
                fieldMaxWidth="100%"
                className="mb-2"
              />
              <PlacePickerField
                label="Held at"
                value={heldAtPlace}
                editable
                onChange={setHeldAtPlace}
                labelWidth="7rem"
                fieldMaxWidth="100%"
                className="mb-0"
              />
            </div>
            <Form.Group>
              <Form.Label className="library-source-filter-heading">
                Type
              </Form.Label>
              <div className="d-flex flex-column gap-2">
                {TYPES.map((type) => (
                  <Form.Check
                    key={type}
                    type="checkbox"
                    id={`type-${type}`}
                    label={getTypeLabel(intl, type)}
                    checked={selectedTypes.includes(type)}
                    onChange={() =>
                      handleToggle(type, selectedTypes, setSelectedTypes)
                    }
                  />
                ))}
              </div>
            </Form.Group>
          </CatalogueFilterDisclosure>
        </aside>
        <div className="catalogue-search-query">
          <TextFilterInput
            value={query}
            onChange={setQuery}
            placeholder="Filter sources"
            ariaLabel="Filter sources"
          />
          {loading && <SourceResultsSkeleton />}
          {!loading && (
            <>
              <div className="catalogue-results-toolbar" aria-live="polite">
                <span>
                  Showing {sources.length} source{sources.length === 1 ? "" : "s"}
                </span>
                <div className="d-flex align-items-center gap-2">
                  <ResultSortSelect
                    value={sortOrder}
                    ariaLabel="Sort sources"
                    onChange={(value) =>
                      setSortOrder(
                        value as
                          | "NAME_ASC"
                          | "NAME_DESC"
                          | "YEAR_ASC"
                          | "YEAR_DESC",
                      )
                    }
                    options={[
                      { value: "NAME_ASC", label: "Name: A–Z" },
                      { value: "NAME_DESC", label: "Name: Z–A" },
                      { value: "YEAR_ASC", label: "Years: oldest first" },
                      { value: "YEAR_DESC", label: "Years: newest first" },
                    ]}
                  />
                  {canContribute(userInfo) && (
                    <PlusActionButton
                      title="Create source"
                      onClick={() => {
                        setError(null);
                        setDraftSource({
                          name: "",
                          description: "",
                          type: "",
                        });
                        setDraftImages([]);
                        setDraftFrom({ year: "", era: "AD" });
                        setDraftTo({ year: "", era: "AD" });
                        setShowCreateModal(true);
                      }}
                    />
                  )}
                </div>
              </div>
              {sources.length === 0 && (
                <div className="tempvs-plain-message text-muted">
                  No sources matched the current filters.
                </div>
              )}
              <Row className="g-3">
                {sortedSources.map((source) => (
                  <Col md={6} key={source.id}>
                    <SourceCard
                      source={source}
                      showPeriodBadge={false}
                      firstImage={sourcePreviewImages[source.id] || null}
                    />
                  </Col>
                ))}
              </Row>
              {nextToken && (
                <div className="d-flex justify-content-center mt-4">
                  <Button
                    variant="outline-dark"
                    disabled={loadingMore}
                    onClick={loadMoreSources}
                  >
                    {loadingMore ? "Loading..." : "Load more sources"}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {canContribute(userInfo) && (
        <Modal
          show={showCreateModal}
          onHide={() => {
            if (!submitting) {
              setDraftImages([]);
              setDraftDiscoveredAtPlace(null);
              setDraftHeldAtPlace(null);
              setShowCreateModal(false);
            }
          }}
          centered
        >
          <Modal.Header closeButton={!submitting}>
            <Modal.Title>Create source</Modal.Title>
          </Modal.Header>
          <Form onSubmit={handleCreateSource}>
            <Modal.Body>
              <Form.Group className="mb-3">
                <Form.Label>Name</Form.Label>
                <Form.Control
                  required
                  value={draftSource.name}
                  onChange={(event) =>
                    setDraftSource((prev) => ({
                      ...prev,
                      name: event.target.value,
                    }))
                  }
                />
              </Form.Group>
              <HistoricalRangeFilter
                enabled
                from={draftFrom}
                to={draftTo}
                onEnabledChange={() => undefined}
                onFromChange={setDraftFrom}
                onToChange={setDraftTo}
                label="Years"
                showToggle={false}
              />
              <div className="mb-3">
                <PlacePickerField
                  label="Discovered at"
                  value={draftDiscoveredAtPlace}
                  editable
                  onChange={setDraftDiscoveredAtPlace}
                  labelWidth="7rem"
                  fieldMaxWidth="100%"
                  className="mb-2"
                  historicalRange={toMapRange(draftFrom, draftTo)}
                />
                <PlacePickerField
                  label="Held at"
                  value={draftHeldAtPlace}
                  editable
                  onChange={setDraftHeldAtPlace}
                  labelWidth="7rem"
                  fieldMaxWidth="100%"
                  className="mb-0"
                  historicalRange={toMapRange(draftFrom, draftTo)}
                />
              </div>
              <Form.Group className="mb-3">
                <Form.Label>Description</Form.Label>
                <Form.Control
                  value={draftSource.description}
                  onChange={(event) =>
                    setDraftSource((prev) => ({
                      ...prev,
                      description: event.target.value,
                    }))
                  }
                />
              </Form.Group>
              <Form.Group>
                <Form.Label>Type</Form.Label>
                <Form.Select
                  required
                  value={draftSource.type}
                  onChange={(event) =>
                    setDraftSource((prev) => ({
                      ...prev,
                      type: event.target.value,
                    }))
                  }
                >
                  <option value="">Choose type</option>
                  {TYPES.map((type) => (
                    <option key={type} value={type}>
                      {getTypeLabel(intl, type)}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
              <MultiImageFilePicker
                files={draftImages}
                onFilesChange={setDraftImages}
                disabled={submitting}
              />
            </Modal.Body>
            <Modal.Footer>
              <Button
                type="button"
                variant="outline-secondary"
                onClick={() => {
                  setDraftImages([]);
                  setDraftDiscoveredAtPlace(null);
                  setDraftHeldAtPlace(null);
                  setShowCreateModal(false);
                }}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" variant="dark" disabled={submitting}>
                {submitting ? "Creating..." : "Create source"}
              </Button>
            </Modal.Footer>
          </Form>
        </Modal>
      )}
    </div>
  );
}

function sourceSortYear(source: LibrarySource): number | null {
  const year = source.from || source.to;
  if (!year) return null;
  return year.era === "BC" ? 1 - year.year : year.year;
}

function placeSearchNames(place: MapPlace): string[] {
  return [
    place.canonicalName,
    ...(place.names ?? []).map((name) => name.value),
  ].filter((name, index, values) =>
    Boolean(name.trim()) &&
    values.findIndex(
      (candidate) =>
        candidate.trim().toLocaleLowerCase() === name.trim().toLocaleLowerCase(),
    ) === index,
  );
}

function SourceResultsSkeleton() {
  return (
    <Row className="g-3" aria-label="Loading sources" aria-busy="true">
      {[0, 1, 2, 3].map((item) => (
        <Col md={6} key={item}>
          <div className="library-source-skeleton" />
        </Col>
      ))}
    </Row>
  );
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
