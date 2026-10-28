import { useEffect, useState } from "react";
import { Alert, Button, Form } from "react-bootstrap";
import { Link, useNavigate } from "react-router-dom";

import { getViewer, type Viewer } from "../auth/viewerApi";
import PageLayout from "../component/PageLayout";
import PlaceSearchAutocomplete from "../component/PlaceSearchAutocomplete";
import SectionBreadcrumb from "../component/SectionBreadcrumb";
import Spinner from "../component/Spinner";
import {
  findLikelyDuplicateMapPlaces,
  getMapPlace,
  proposeMapPlaceChangeset,
  searchMapPlaces,
  type MapPlace,
} from "./mapApi";
import MapCanvas from "./MapCanvas";

type MapPlaceEditPageProps = { id?: string };
type ChangeMode = "UPDATE" | "DELETE" | "MERGE";
type NameDraft = {
  value: string;
  preferred: boolean;
  validFrom: string;
  validTo: string;
};
type HistoricalEventDraft = {
  description: string;
  validFrom: string;
  validTo: string;
};

type PlaceEditDraft = {
  name: string;
  featureType: string;
  latitude: string;
  longitude: string;
  description: string;
  citationUrl: string;
  names: NameDraft[];
  historicalEvents: HistoricalEventDraft[];
  note: string;
  savedAt: string;
};

const featureTypes = [
  "SETTLEMENT",
  "HISTORIC_SETTLEMENT",
  "ARCHAEOLOGICAL_SITE",
  "BUILDING",
  "REGION",
  "BATTLEFIELD",
  "OTHER",
];

const canContribute = (viewer: Viewer | null) =>
  Boolean(
    viewer?.roles.some((role) =>
      ["TEMPVS_ADMIN", "MAP_ADMIN", "MAP_EDITOR", "MAP_REVIEWER"].includes(
        role,
      ),
    ),
  );

/** The approved-place editor only creates a private changeset. It deliberately
 * never writes the public place directly, matching the Library source review
 * flow and preserving an editor-visible audit record for every mutation. */
export default function MapPlaceEditPage({ id }: MapPlaceEditPageProps) {
  const navigate = useNavigate();
  const [viewer, setViewer] = useState<Viewer | null | undefined>(undefined);
  const [place, setPlace] = useState<MapPlace | null | undefined>(undefined);
  const [mode, setMode] = useState<ChangeMode>("UPDATE");
  const [name, setName] = useState("");
  const [featureType, setFeatureType] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [description, setDescription] = useState("");
  const [citationUrl, setCitationUrl] = useState("");
  const [names, setNames] = useState<NameDraft[]>([]);
  const [historicalEvents, setHistoricalEvents] = useState<
    HistoricalEventDraft[]
  >([]);
  const [note, setNote] = useState("");
  const [mergeQuery, setMergeQuery] = useState("");
  const [mergeResults, setMergeResults] = useState<MapPlace[] | null>(null);
  const [mergeTarget, setMergeTarget] = useState<MapPlace | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [savedDraft, setSavedDraft] = useState<PlaceEditDraft | null>(null);
  const [likelyDuplicates, setLikelyDuplicates] = useState<MapPlace[]>([]);

  useEffect(() => {
    void getViewer({ refreshRoles: true }).then(setViewer);
  }, []);

  useEffect(() => {
    if (!id) {
      setPlace(null);
      return;
    }
    const controller = new AbortController();
    void getMapPlace(id, controller.signal)
      .then((value) => {
        if (controller.signal.aborted) return;
        setPlace(value);
        if (!value) return;
        setName(value.canonicalName);
        setFeatureType(value.featureType);
        setLatitude(String(value.latitude));
        setLongitude(String(value.longitude));
        setDescription(value.description || "");
        setCitationUrl(value.citationUrl || "");
        setNames(nameDrafts(value));
        setHistoricalEvents(historicalEventDrafts(value));
        setSavedDraft(readDraft(value.id));
      })
      .catch(() => !controller.signal.aborted && setPlace(null));
    return () => controller.abort();
  }, [id]);

  useEffect(() => {
    if (mode !== "MERGE" || mergeQuery.trim().length < 2) {
      setMergeResults(null);
      return undefined;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void searchMapPlaces(mergeQuery, controller.signal)
        .then(
          (results) =>
            !controller.signal.aborted &&
            setMergeResults(
              results.filter((result) => result.id !== place?.id),
            ),
        )
        .catch(() => !controller.signal.aborted && setMergeResults([]));
    }, 180);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [mergeQuery, mode, place?.id]);

  useEffect(() => {
    if (
      mode !== "UPDATE" ||
      name.trim().length < 2 ||
      !validCoordinates(latitude, longitude)
    ) {
      setLikelyDuplicates([]);
      return undefined;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void findLikelyDuplicateMapPlaces(
        name.trim(),
        Number(latitude),
        Number(longitude),
        controller.signal,
      )
        .then(
          (results) =>
            !controller.signal.aborted &&
            setLikelyDuplicates(
              results.filter((result) => result.id !== place?.id),
            ),
        )
        .catch(() => !controller.signal.aborted && setLikelyDuplicates([]));
    }, 300);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [latitude, longitude, mode, name, place?.id]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!place) return;
    if (!note.trim() || note.trim().length < 8) {
      setError("Add an explanation of at least 8 characters for reviewers.");
      return;
    }
    if (mode === "MERGE" && !mergeTarget) {
      setError("Choose the approved place that will become canonical.");
      return;
    }
    if (
      mode === "UPDATE" &&
      (!name.trim() ||
        !featureType.trim() ||
        !validCoordinates(latitude, longitude) ||
        names.filter((entry) => entry.preferred).length !== 1 ||
        !names.some(
          (entry) => entry.preferred && entry.value.trim() === name.trim(),
        ) ||
        names.some((entry) => invalidDatedEntry(entry)) ||
        historicalEvents.some(
          (entry) =>
            !entry.description.trim() ||
            (!entry.validFrom.trim() && !entry.validTo.trim()) ||
            !isWholeYearOrBlank(entry.validFrom) ||
            !isWholeYearOrBlank(entry.validTo) ||
            (entry.validFrom.trim() &&
              entry.validTo.trim() &&
              Number(entry.validFrom) > Number(entry.validTo)),
        ))
    ) {
      setError(
        "Provide valid coordinates, names, and historical event dates. Each event needs a description and a year or year range.",
      );
      return;
    }
    setSaving(true);
    setError("");
    try {
      const changeset =
        mode === "DELETE"
          ? { kind: "DELETE" as const, note: note.trim() }
          : mode === "MERGE"
            ? {
                kind: "MERGE" as const,
                note: note.trim(),
                mergeTargetPlaceId: mergeTarget!.id,
              }
            : {
                kind: "UPDATE" as const,
                canonicalName: name.trim(),
                featureType: featureType.trim(),
                latitude: Number(latitude),
                longitude: Number(longitude),
                note: note.trim(),
                description,
                citationUrl,
                names: names.map((entry) => ({
                  value: entry.value.trim(),
                  preferred: entry.preferred,
                  ...(entry.validFrom.trim()
                    ? { validFrom: Number(entry.validFrom) }
                    : {}),
                  ...(entry.validTo.trim()
                    ? { validTo: Number(entry.validTo) }
                    : {}),
                })),
                historicalEvents: historicalEvents.map((entry) => ({
                  description: entry.description.trim(),
                  ...(entry.validFrom.trim()
                    ? { validFrom: Number(entry.validFrom) }
                    : {}),
                  ...(entry.validTo.trim()
                    ? { validTo: Number(entry.validTo) }
                    : {}),
                })),
              };
      await proposeMapPlaceChangeset(place.id, changeset);
      window.localStorage.removeItem(draftKey(place.id));
      setSavedDraft(null);
      navigate(`/map/place/${encodeURIComponent(place.id)}/proposals`);
    } catch (caught) {
      setError((caught as Error).message || "Unable to submit this changeset.");
    } finally {
      setSaving(false);
    }
  };

  if (place === undefined || viewer === undefined)
    return (
      <PageLayout header={{ title: "Edit place" }}>
        <Spinner size="sm" />
      </PageLayout>
    );
  if (!place)
    return (
      <PageLayout header={{ title: "Edit place" }}>
        <Alert variant="warning">This place is not available.</Alert>
      </PageLayout>
    );

  const editable = canContribute(viewer);
  const saveDraft = () => {
    if (!place) return;
    const draft: PlaceEditDraft = {
      name,
      featureType,
      latitude,
      longitude,
      description,
      citationUrl,
      names,
      historicalEvents,
      note,
      savedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(draftKey(place.id), JSON.stringify(draft));
    setSavedDraft(draft);
  };
  const restoreDraft = () => {
    if (!savedDraft) return;
    setName(savedDraft.name);
    setFeatureType(savedDraft.featureType);
    setLatitude(savedDraft.latitude);
    setLongitude(savedDraft.longitude);
    setDescription(savedDraft.description);
    setCitationUrl(savedDraft.citationUrl);
    setNames(savedDraft.names);
    setHistoricalEvents(savedDraft.historicalEvents);
    setNote(savedDraft.note);
  };
  const discardDraft = () => {
    window.localStorage.removeItem(draftKey(place.id));
    setSavedDraft(null);
  };
  const changeSummary = place
    ? summarizeChanges(place, {
        name,
        featureType,
        latitude,
        longitude,
        description,
        citationUrl,
        names,
        historicalEvents,
      })
    : [];
  return (
    <PageLayout
      className="map-page"
      header={{
        title: (
          <SectionBreadcrumb
            items={[
              { label: "Map", to: "/map" },
              { label: place.canonicalName },
            ]}
          />
        ),
      }}
    >
      <section className="club-panel">
        <p className="text-muted mb-3">
          Changes to <strong>{place.canonicalName}</strong> are submitted as a
          private changeset. A Map editor must review it before public map data
          changes.
        </p>
        {!editable && (
          <Alert variant="warning">
            A Map reviewer role is required. Request one from Map administration
            before submitting changes.
          </Alert>
        )}
        <ol className="place-editor-steps" aria-label="Place editing steps">
          <li>Name and type</li>
          <li>Location</li>
          <li>Historical context</li>
          <li>Evidence and review</li>
        </ol>
        {editable && savedDraft && !submitted && (
          <Alert
            variant="secondary"
            className="d-flex flex-wrap align-items-center gap-2"
          >
            <span>
              An unsent local draft was saved{" "}
              {new Date(savedDraft.savedAt).toLocaleString()}.
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline-dark"
              onClick={restoreDraft}
            >
              Restore draft
            </Button>
            <Button
              type="button"
              size="sm"
              variant="link"
              onClick={discardDraft}
            >
              Discard
            </Button>
          </Alert>
        )}
        {submitted ? (
          <Alert variant="success">
            Submitted for Map review.{" "}
            <Link to={`/map/place/${encodeURIComponent(place.id)}`}>
              Return to the place
            </Link>
          </Alert>
        ) : (
          <Form onSubmit={submit}>
            <Form.Group className="mb-3">
              <Form.Label>Change type</Form.Label>
              <Form.Select
                value={mode}
                onChange={(event) => setMode(event.target.value as ChangeMode)}
                disabled={!editable}
              >
                <option value="UPDATE">Edit place details</option>
                <option value="MERGE">Merge into another place</option>
                <option value="DELETE">Delete an unused place</option>
              </Form.Select>
            </Form.Group>
            {mode === "UPDATE" && (
              <>
                <Form.Group id="place-editor-name" className="mb-2">
                  <Form.Label>Canonical name</Form.Label>
                  <Form.Control
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    disabled={!editable}
                  />
                </Form.Group>
                <Form.Group className="mb-2">
                  <Form.Label>Feature type</Form.Label>
                  <Form.Select
                    value={featureType}
                    onChange={(event) => setFeatureType(event.target.value)}
                    disabled={!editable}
                  >
                    {featureTypes.map((type) => (
                      <option key={type} value={type}>
                        {type.replaceAll("_", " ")}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
                <div id="place-editor-location" className="d-flex gap-2">
                  <Form.Group className="mb-2 flex-fill">
                    <Form.Label>Latitude</Form.Label>
                    <Form.Control
                      inputMode="decimal"
                      value={latitude}
                      onChange={(event) => setLatitude(event.target.value)}
                      disabled={!editable}
                    />
                  </Form.Group>
                  <Form.Group className="mb-2 flex-fill">
                    <Form.Label>Longitude</Form.Label>
                    <Form.Control
                      inputMode="decimal"
                      value={longitude}
                      onChange={(event) => setLongitude(event.target.value)}
                      disabled={!editable}
                    />
                  </Form.Group>
                </div>
                <MapCanvas
                  places={[place]}
                  entities={[]}
                  focus={{
                    latitude: Number(latitude) || place.latitude,
                    longitude: Number(longitude) || place.longitude,
                  }}
                  pickedCoordinate={
                    validCoordinates(latitude, longitude)
                      ? {
                          latitude: Number(latitude),
                          longitude: Number(longitude),
                        }
                      : null
                  }
                  showModernBorders={false}
                  onEntitySelect={() => undefined}
                  onCoordinatePick={(coordinate) => {
                    setLatitude(coordinate.latitude.toFixed(6));
                    setLongitude(coordinate.longitude.toFixed(6));
                  }}
                  onMapError={() => undefined}
                />
                <Form.Text className="d-block mb-3">
                  Click the map to refine the coordinates. The pin is the
                  proposed location.
                </Form.Text>
                {likelyDuplicates.length > 0 && (
                  <Alert variant="warning">
                    <strong>Possible existing places nearby</strong>
                    <ul className="mb-0 mt-1">
                      {likelyDuplicates.map((candidate) => (
                        <li key={candidate.id}>
                          <Link
                            to={`/map/place/${encodeURIComponent(candidate.id)}`}
                          >
                            {candidate.canonicalName}
                          </Link>{" "}
                          ({candidate.featureType.replaceAll("_", " ")})
                        </li>
                      ))}
                    </ul>
                    Open an existing place if it represents the same location,
                    or continue when this is genuinely distinct.
                  </Alert>
                )}
                <Form.Group className="mb-2">
                  <Form.Label>Description</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    disabled={!editable}
                  />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Evidence URL</Form.Label>
                  <Form.Control
                    type="url"
                    value={citationUrl}
                    onChange={(event) => setCitationUrl(event.target.value)}
                    disabled={!editable}
                  />
                </Form.Group>
                <fieldset
                  id="place-editor-history"
                  className="border rounded p-3 mb-3"
                >
                  <legend className="float-none w-auto px-2 fs-6 mb-0">
                    Historical names
                  </legend>
                  <p className="small text-muted">
                    Set the years in which each name applies. Leave a year blank
                    for an open interval.
                  </p>
                  {names.map((entry, index) => (
                    <div
                      key={index}
                      className="d-flex gap-2 align-items-end mb-2"
                    >
                      <Form.Check
                        label="Preferred"
                        checked={entry.preferred}
                        onChange={() =>
                          setNames((current) =>
                            current.map((nameEntry, nameIndex) => ({
                              ...nameEntry,
                              preferred: nameIndex === index,
                            })),
                          )
                        }
                        disabled={!editable}
                      />
                      <Form.Control
                        aria-label="Place name"
                        value={entry.value}
                        onChange={(event) =>
                          setNames((current) =>
                            replaceName(current, index, {
                              value: event.target.value,
                            }),
                          )
                        }
                        disabled={!editable}
                      />
                      <Form.Control
                        aria-label="Name valid from"
                        placeholder="From year"
                        value={entry.validFrom}
                        onChange={(event) =>
                          setNames((current) =>
                            replaceName(current, index, {
                              validFrom: event.target.value,
                            }),
                          )
                        }
                        disabled={!editable}
                      />
                      <Form.Control
                        aria-label="Name valid to"
                        placeholder="To year"
                        value={entry.validTo}
                        onChange={(event) =>
                          setNames((current) =>
                            replaceName(current, index, {
                              validTo: event.target.value,
                            }),
                          )
                        }
                        disabled={!editable}
                      />
                      <Button
                        variant="outline-danger"
                        disabled={!editable || names.length === 1}
                        onClick={() =>
                          setNames((current) =>
                            current.filter(
                              (_, nameIndex) => nameIndex !== index,
                            ),
                          )
                        }
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline-dark"
                    disabled={!editable}
                    onClick={() =>
                      setNames((current) => [
                        ...current,
                        {
                          value: "",
                          preferred: false,
                          validFrom: "",
                          validTo: "",
                        },
                      ])
                    }
                  >
                    Add historical name
                  </Button>
                </fieldset>
                <fieldset className="border rounded p-3 mb-3">
                  <legend className="float-none w-auto px-2 fs-6 mb-0">
                    Important dates and events
                  </legend>
                  <p className="small text-muted">
                    Add a notable event at this place. Use one year for a single
                    event or both years for a range.
                  </p>
                  {historicalEvents.map((entry, index) => (
                    <div
                      key={index}
                      className="d-flex gap-2 align-items-end mb-2"
                    >
                      <Form.Control
                        aria-label="Historical event description"
                        placeholder="What happened here?"
                        value={entry.description}
                        onChange={(event) =>
                          setHistoricalEvents((current) =>
                            replaceHistoricalEvent(current, index, {
                              description: event.target.value,
                            }),
                          )
                        }
                        disabled={!editable}
                      />
                      <Form.Control
                        aria-label="Event from year"
                        placeholder="From year"
                        value={entry.validFrom}
                        onChange={(event) =>
                          setHistoricalEvents((current) =>
                            replaceHistoricalEvent(current, index, {
                              validFrom: event.target.value,
                            }),
                          )
                        }
                        disabled={!editable}
                      />
                      <Form.Control
                        aria-label="Event to year"
                        placeholder="To year"
                        value={entry.validTo}
                        onChange={(event) =>
                          setHistoricalEvents((current) =>
                            replaceHistoricalEvent(current, index, {
                              validTo: event.target.value,
                            }),
                          )
                        }
                        disabled={!editable}
                      />
                      <Button
                        type="button"
                        variant="outline-danger"
                        disabled={!editable}
                        onClick={() =>
                          setHistoricalEvents((current) =>
                            current.filter(
                              (_, eventIndex) => eventIndex !== index,
                            ),
                          )
                        }
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline-dark"
                    disabled={!editable || historicalEvents.length >= 50}
                    onClick={() =>
                      setHistoricalEvents((current) => [
                        ...current,
                        { description: "", validFrom: "", validTo: "" },
                      ])
                    }
                  >
                    Add important event
                  </Button>
                </fieldset>
              </>
            )}
            {mode === "MERGE" && (
              <Form.Group className="mb-3">
                <Form.Label>Merge into approved place</Form.Label>
                <PlaceSearchAutocomplete
                  query={mergeQuery}
                  onQueryChange={(value) => {
                    setMergeQuery(value);
                    setMergeTarget(null);
                  }}
                  results={mergeResults}
                  loading={false}
                  failed={false}
                  onSelect={(result) => {
                    setMergeTarget(result);
                    setMergeQuery(result.canonicalName);
                    setMergeResults(null);
                  }}
                  placeholder="Search approved places"
                  ariaLabel="Search merge target"
                />
                {mergeTarget && (
                  <Form.Text>
                    Resources currently mapped to this place will be reassigned
                    to <strong>{mergeTarget.canonicalName}</strong>.
                  </Form.Text>
                )}
              </Form.Group>
            )}
            {mode === "DELETE" && (
              <Alert variant="warning">
                Deletion is allowed only when no resources are mapped here.
                Merge instead to retain and reassign resources.
              </Alert>
            )}
            <Form.Group id="place-editor-review" className="mb-3">
              <Form.Label>Reason for review</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                minLength={8}
                maxLength={2000}
                disabled={!editable}
                required
              />
            </Form.Group>
            {error && <Alert variant="danger">{error}</Alert>}
            {mode === "UPDATE" && changeSummary.length > 0 && (
              <details className="place-editor-summary mb-3">
                <summary>
                  Review proposed changes ({changeSummary.length})
                </summary>
                <ul className="mb-0 mt-2">
                  {changeSummary.map((change) => (
                    <li key={change}>{change}</li>
                  ))}
                </ul>
              </details>
            )}
            <div className="d-flex gap-2">
              <Link
                className="btn btn-outline-secondary"
                to={`/map/place/${encodeURIComponent(place.id)}`}
              >
                Cancel
              </Link>
              <Button
                type="button"
                variant="outline-dark"
                disabled={!editable || saving || mode !== "UPDATE"}
                onClick={saveDraft}
              >
                Save draft
              </Button>
              <Button
                type="submit"
                variant={mode === "DELETE" ? "outline-danger" : "dark"}
                disabled={!editable || saving}
              >
                {saving ? "Submitting…" : "Submit changeset for review"}
              </Button>
            </div>
          </Form>
        )}
      </section>
    </PageLayout>
  );
}

function nameDrafts(place: MapPlace): NameDraft[] {
  const values = place.names?.length
    ? place.names
    : [{ value: place.canonicalName, preferred: true }];
  return values.map((entry) => ({
    value: entry.value,
    preferred: entry.preferred,
    validFrom: entry.validFrom === undefined ? "" : String(entry.validFrom),
    validTo: entry.validTo === undefined ? "" : String(entry.validTo),
  }));
}

function historicalEventDrafts(place: MapPlace): HistoricalEventDraft[] {
  return (place.historicalEvents ?? []).map((event) => ({
    description: event.description,
    validFrom: event.validFrom === undefined ? "" : String(event.validFrom),
    validTo: event.validTo === undefined ? "" : String(event.validTo),
  }));
}

function replaceName(
  names: NameDraft[],
  index: number,
  update: Partial<NameDraft>,
): NameDraft[] {
  return names.map((entry, entryIndex) =>
    entryIndex === index ? { ...entry, ...update } : entry,
  );
}

function replaceHistoricalEvent(
  events: HistoricalEventDraft[],
  index: number,
  update: Partial<HistoricalEventDraft>,
): HistoricalEventDraft[] {
  return events.map((entry, entryIndex) =>
    entryIndex === index ? { ...entry, ...update } : entry,
  );
}

function isWholeYearOrBlank(value: string): boolean {
  return !value.trim() || Number.isSafeInteger(Number(value));
}

function invalidDatedEntry(
  entry: Pick<NameDraft, "value" | "validFrom" | "validTo">,
): boolean {
  return (
    !entry.value.trim() ||
    !isWholeYearOrBlank(entry.validFrom) ||
    !isWholeYearOrBlank(entry.validTo) ||
    (Boolean(entry.validFrom.trim()) &&
      Boolean(entry.validTo.trim()) &&
      Number(entry.validFrom) > Number(entry.validTo))
  );
}

function validCoordinates(latitude: string, longitude: string): boolean {
  const lat = Number(latitude);
  const lng = Number(longitude);
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

function draftKey(placeId: string): string {
  return `tempvs:map-place-edit:${placeId}`;
}

function readDraft(placeId: string): PlaceEditDraft | null {
  try {
    const value = window.localStorage.getItem(draftKey(placeId));
    if (!value) return null;
    const parsed = JSON.parse(value) as Partial<PlaceEditDraft>;
    if (
      typeof parsed.name !== "string" ||
      typeof parsed.featureType !== "string" ||
      typeof parsed.latitude !== "string" ||
      typeof parsed.longitude !== "string" ||
      typeof parsed.description !== "string" ||
      typeof parsed.citationUrl !== "string" ||
      typeof parsed.note !== "string" ||
      typeof parsed.savedAt !== "string" ||
      !Array.isArray(parsed.names) ||
      !Array.isArray(parsed.historicalEvents)
    )
      return null;
    return parsed as PlaceEditDraft;
  } catch {
    return null;
  }
}

function summarizeChanges(
  place: MapPlace,
  draft: Pick<
    PlaceEditDraft,
    | "name"
    | "featureType"
    | "latitude"
    | "longitude"
    | "description"
    | "citationUrl"
    | "names"
    | "historicalEvents"
  >,
): string[] {
  const changes: string[] = [];
  if (draft.name.trim() !== place.canonicalName)
    changes.push("Changed canonical name");
  if (draft.featureType !== place.featureType)
    changes.push("Changed place type");
  if (
    Number(draft.latitude) !== place.latitude ||
    Number(draft.longitude) !== place.longitude
  )
    changes.push("Changed map coordinates");
  if (draft.description.trim() !== (place.description || "").trim())
    changes.push("Changed description");
  if (draft.citationUrl.trim() !== (place.citationUrl || "").trim())
    changes.push("Changed evidence URL");
  if (JSON.stringify(draft.names) !== JSON.stringify(nameDrafts(place)))
    changes.push("Changed historical names");
  if (
    JSON.stringify(draft.historicalEvents) !==
    JSON.stringify(historicalEventDrafts(place))
  )
    changes.push("Changed important dates or events");
  return changes;
}
