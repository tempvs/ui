import { useEffect, useState } from "react";
import { Alert, Button, Form } from "react-bootstrap";
import { Link } from "react-router-dom";

import { getViewer, type Viewer } from "../auth/viewerApi";
import PageLayout from "../component/PageLayout";
import PlaceSearchAutocomplete from "../component/PlaceSearchAutocomplete";
import Spinner from "../component/Spinner";
import {
  getMapPlace,
  proposeMapPlaceChangeset,
  searchMapPlaces,
  type MapPlace,
  type MapPlaceName,
} from "./mapApi";

type MapPlaceEditPageProps = { id?: string };
type ChangeMode = "UPDATE" | "DELETE" | "MERGE";
type NameDraft = {
  value: string;
  preferred: boolean;
  validFrom: string;
  validTo: string;
};

const canContribute = (viewer: Viewer | null) =>
  Boolean(
    viewer?.roles.some((role) =>
      [
        "TEMPVS_ADMIN",
        "MAP_ADMIN",
        "MAP_EDITOR",
        "MAP_REVIEWER",
        "MAP_CONTRIBUTOR",
      ].includes(role),
    ),
  );

/** The approved-place editor only creates a private changeset. It deliberately
 * never writes the public place directly, matching the Library source review
 * flow and preserving an editor-visible audit record for every mutation. */
export default function MapPlaceEditPage({ id }: MapPlaceEditPageProps) {
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
  const [note, setNote] = useState("");
  const [mergeQuery, setMergeQuery] = useState("");
  const [mergeResults, setMergeResults] = useState<MapPlace[] | null>(null);
  const [mergeTarget, setMergeTarget] = useState<MapPlace | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

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
        !Number.isFinite(Number(latitude)) ||
        !Number.isFinite(Number(longitude)) ||
        names.filter((entry) => entry.preferred).length !== 1 ||
        !names.some(
          (entry) => entry.preferred && entry.value.trim() === name.trim(),
        ))
    ) {
      setError(
        "Provide valid coordinates and exactly one preferred name matching the canonical name.",
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
              };
      await proposeMapPlaceChangeset(place.id, changeset);
      setSubmitted(true);
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
  return (
    <PageLayout className="map-page" header={{ title: "Edit place" }}>
      <section className="club-panel">
        <p className="text-muted mb-3">
          Changes to <strong>{place.canonicalName}</strong> are submitted as a
          private changeset. A Map editor must review it before public map data
          changes.
        </p>
        {!editable && (
          <Alert variant="warning">
            A Map contributor role is required. Request one from Map
            administration before submitting changes.
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
                <Form.Group className="mb-2">
                  <Form.Label>Canonical name</Form.Label>
                  <Form.Control
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    disabled={!editable}
                  />
                </Form.Group>
                <Form.Group className="mb-2">
                  <Form.Label>Feature type</Form.Label>
                  <Form.Control
                    value={featureType}
                    onChange={(event) => setFeatureType(event.target.value)}
                    disabled={!editable}
                  />
                </Form.Group>
                <div className="d-flex gap-2">
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
                <fieldset className="border rounded p-3 mb-3">
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
            <Form.Group className="mb-3">
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
            <div className="d-flex gap-2">
              <Link
                className="btn btn-outline-secondary"
                to={`/map/place/${encodeURIComponent(place.id)}`}
              >
                Cancel
              </Link>
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

function replaceName(
  names: NameDraft[],
  index: number,
  update: Partial<NameDraft>,
): NameDraft[] {
  return names.map((entry, entryIndex) =>
    entryIndex === index ? { ...entry, ...update } : entry,
  );
}
