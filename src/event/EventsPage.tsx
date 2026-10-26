import React, { useEffect, useState } from "react";
import { Alert, Button, Modal } from "react-bootstrap";
import { Link, useNavigate } from "react-router-dom";
import TextFilterInput from "../component/TextFilterInput";
import PeriodMultiSelect from "../component/PeriodMultiSelect";
import HistoricalRangeFilter, {
  formatHistoricalRange,
  type HistoricalYearInput,
} from "../component/HistoricalRangeFilter";
import PlacePickerField from "../component/PlacePickerField";
import type { MapPlace } from "../map/mapApi";
import PageLayout from "../component/PageLayout";
import CatalogueFilterDisclosure from "../component/CatalogueFilterDisclosure";
import ResultSortSelect from "../component/ResultSortSelect";
import SectionBreadcrumb from "../component/SectionBreadcrumb";
import { DEFAULT_HOURGLASS_IMAGE_SRC } from "../component/DefaultHourglassImage";
import RefreshingImage from "../image/RefreshingImage";
import {
  fetchClubProfiles,
  fetchCurrentUserInfo,
  fetchUserProfileByUserId,
} from "../profile/profileApi";
import { Profile } from "../profile/profileTypes";
import { PeriodBadge, type Period } from "../util/periods";
import EventForm from "./EventForm";
import { createEvent, EventDraft, listEvents, TempvsEvent } from "./eventApi";
import {
  overlapsHistoricalRange,
  rangeFromInputs,
} from "../search/publicSearchFilterContract";
import "./events.css";

export default function EventsPage() {
  const navigate = useNavigate();
  const [events, setEvents] = useState<TempvsEvent[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [query, setQuery] = useState("");
  const [selectedPeriods, setSelectedPeriods] = useState<Period[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortOrder, setSortOrder] = useState<
    "DATE_ASC" | "DATE_DESC" | "NAME_ASC" | "NAME_DESC"
  >("DATE_ASC");
  const [from, setFrom] = useState<HistoricalYearInput>({
    year: "",
    era: "AD",
  });
  const [to, setTo] = useState<HistoricalYearInput>({ year: "", era: "AD" });
  const [venue, setVenue] = useState<MapPlace | null>(null);
  const [historicalSite, setHistoricalSite] = useState<MapPlace | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    listEvents(controller.signal)
      .then((result) => setEvents(result.content || []))
      .catch((error) => {
        if (error.name !== "AbortError") setError(error.message);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  useEffect(
    () =>
      fetchCurrentUserInfo((result) => {
        if (!result.currentUserId) return;
        const userId = result.currentUserId;
        let personal: Profile | null = null;
        let clubs: Profile[] = [];
        const finish = () =>
          setProfiles([...(personal ? [personal] : []), ...clubs]);
        fetchUserProfileByUserId(userId, {
          onSuccess: (profile) => {
            personal = profile;
            finish();
          },
          onMissing: finish,
          onError: finish,
        });
        fetchClubProfiles(userId, {
          onSuccess: (values) => {
            clubs = values;
            finish();
          },
          onError: finish,
        });
      }),
    [],
  );

  const save = async (draft: EventDraft) => {
    setBusy(true);
    setError("");
    try {
      const created = await createEvent(draft);
      navigate(`/events/${created.id}`);
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const normalized = query.trim().toLocaleLowerCase();
  const range = rangeFromInputs(from, to);
  const hasYearFilter = Boolean(range.from || range.to);
  const hasActiveFilters = Boolean(
    normalized ||
    selectedPeriods.length ||
    hasYearFilter ||
    venue ||
    historicalSite,
  );
  const clearFilters = () => {
    setQuery("");
    setSelectedPeriods([]);
    setFrom({ year: "", era: "AD" });
    setTo({ year: "", era: "AD" });
    setVenue(null);
    setHistoricalSite(null);
  };
  const visible = events.filter((event) => {
    if (
      !normalized &&
      !selectedPeriods.length &&
      !hasYearFilter &&
      !venue &&
      !historicalSite
    ) {
      return true;
    }
    const textMatch =
      !normalized ||
      `${event.name} ${event.description || ""}`
        .toLocaleLowerCase()
        .includes(normalized);
    const venueMatch = !venue || event.venuePlaceId === venue.id;
    const historicalSiteMatch =
      !historicalSite || event.historicalSitePlaceId === historicalSite.id;
    const periodMatch =
      selectedPeriods.length === 0 ||
      event.periods.some((eventPeriod) =>
        selectedPeriods.includes(eventPeriod),
      );
    if (!textMatch || !venueMatch || !historicalSiteMatch || !periodMatch) {
      return textMatch && venueMatch && historicalSiteMatch && periodMatch;
    }
    return !hasYearFilter || overlapsHistoricalRange(event, range);
  });
  const sortedVisible = [...visible].sort((left, right) => {
    if (sortOrder === "NAME_ASC") return left.name.localeCompare(right.name);
    if (sortOrder === "NAME_DESC") return right.name.localeCompare(left.name);

    const leftTimestamp = eventSortTimestamp(left);
    const rightTimestamp = eventSortTimestamp(right);
    if (leftTimestamp === null && rightTimestamp === null) return 0;
    if (leftTimestamp === null) return 1;
    if (rightTimestamp === null) return -1;

    return sortOrder === "DATE_ASC"
      ? leftTimestamp - rightTimestamp
      : rightTimestamp - leftTimestamp;
  });

  return (
    <PageLayout
      className="events-page"
      header={{
        title: <SectionBreadcrumb items={[{ label: "Events" }]} />,
        rightContent:
          profiles.length > 0 ? (
            <Button variant="secondary" onClick={() => setCreating(true)}>
              Create event
            </Button>
          ) : null,
      }}
    >
      {error && !creating && <Alert variant="danger">{error}</Alert>}
      <>
        <div className="event-search-layout">
          <aside className="event-search-filters">
            <CatalogueFilterDisclosure
              open={filtersOpen}
              onOpenChange={setFiltersOpen}
              hasActiveFilters={hasActiveFilters}
              activeCount={
                selectedPeriods.length +
                Number(hasYearFilter) +
                Number(Boolean(venue)) +
                Number(Boolean(historicalSite))
              }
              inactiveSummary="All events"
              onClearFilters={clearFilters}
            >
              <PeriodMultiSelect
                ariaLabel="Period"
                selected={selectedPeriods}
                onChange={setSelectedPeriods}
                display="checkboxes"
              />
              <PlacePickerField
                label="Venue"
                value={venue}
                editable
                onChange={setVenue}
                labelWidth="6.5rem"
                fieldMaxWidth="15rem"
                className="mb-2"
              />
              <PlacePickerField
                label="Historical site"
                value={historicalSite}
                editable
                onChange={setHistoricalSite}
                labelWidth="6.5rem"
                fieldMaxWidth="15rem"
                className="mb-2"
              />
              <HistoricalRangeFilter
                enabled
                from={from}
                to={to}
                onEnabledChange={() => undefined}
                onFromChange={setFrom}
                onToChange={setTo}
                label="Years"
                showToggle={false}
                alwaysShowFields
                compact
              />
            </CatalogueFilterDisclosure>
          </aside>
          <div className="event-search-query">
            <TextFilterInput
              value={query}
              onChange={setQuery}
              placeholder="Filter events"
              ariaLabel="Filter events"
            />
            <div className="event-results-toolbar" aria-live="polite">
              <span>
                {loading
                  ? "Updating events…"
                  : `Showing ${visible.length} event${visible.length === 1 ? "" : "s"}`}
              </span>
              <ResultSortSelect
                value={sortOrder}
                ariaLabel="Sort events"
                onChange={(value) =>
                  setSortOrder(
                    value as
                      | "DATE_ASC"
                      | "DATE_DESC"
                      | "NAME_ASC"
                      | "NAME_DESC",
                  )
                }
                options={[
                  { value: "DATE_ASC", label: "Sooner first" },
                  { value: "DATE_DESC", label: "Sooner last" },
                  { value: "NAME_ASC", label: "Name: A–Z" },
                  { value: "NAME_DESC", label: "Name: Z–A" },
                ]}
              />
            </div>
            <div className="event-card-grid event-search-results">
              {sortedVisible.map((event) => (
                <article className="event-panel event-card" key={event.id}>
                  <Link
                    to={`/events/${event.id}`}
                    className="event-card-image-link"
                  >
                    <RefreshingImage
                      image={{ resourceType: "event", resourceId: event.id }}
                      variant="thumbnail"
                      fallbackSrc={DEFAULT_HOURGLASS_IMAGE_SRC}
                      className="event-card-image"
                      alt={`${event.name} thumbnail`}
                    />
                  </Link>
                  <div className="event-card-content">
                    <div className="event-period-badges">
                      {event.periods.map((period) => (
                        <PeriodBadge key={period} period={period} />
                      ))}
                    </div>
                    {isPastEvent(event) && (
                      <span className="event-past-badge">Past event</span>
                    )}
                    <h2>
                      <Link to={`/events/${event.id}`}>{event.name}</Link>
                    </h2>
                    <time>{formatEventCardDate(event)}</time>
                    {(event.venuePlaceName ||
                      event.historicalSitePlaceName) && (
                      <p className="event-card-place">
                        {event.venuePlaceName
                          ? `Venue: ${event.venuePlaceName}`
                          : `Historical site: ${event.historicalSitePlaceName}`}
                      </p>
                    )}
                    {(event.from || event.to) && (
                      <p className="event-card-temporal">
                        {formatHistoricalRange(event.from, event.to)}
                      </p>
                    )}
                    {event.description && <p>{event.description}</p>}
                  </div>
                </article>
              ))}
              {loading && events.length === 0 && <EventResultsSkeleton />}
            </div>
            {loading && <p role="status">Loading events…</p>}
            {!loading && !error && visible.length === 0 && (
              <p className="event-panel">No events found.</p>
            )}
          </div>
        </div>
      </>
      <Modal
        show={creating}
        onHide={() => {
          if (!busy) setCreating(false);
        }}
        centered
      >
        <Modal.Header closeButton={!busy}>
          <Modal.Title>Create event</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {error && <Alert variant="danger">{error}</Alert>}
          <EventForm
            profiles={profiles}
            busy={busy}
            onSave={save}
            onCancel={() => setCreating(false)}
          />
        </Modal.Body>
      </Modal>
    </PageLayout>
  );
}

function eventSortTimestamp(event: TempvsEvent): number | null {
  if (!event.schedule.startsAt) return null;
  const value = new Date(event.schedule.startsAt).getTime();
  return Number.isFinite(value) ? value : null;
}

function isPastEvent(event: TempvsEvent): boolean {
  const end = event.schedule.endsAt || event.schedule.startsAt;
  return Boolean(end && new Date(end).getTime() < Date.now());
}

function formatEventCardDate(event: TempvsEvent): string {
  if (!event.schedule.startsAt) return "Dates to be announced";
  const date = new Date(event.schedule.startsAt);
  if (!Number.isFinite(date.getTime())) return "Dates to be announced";
  const value = new Intl.DateTimeFormat("en", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
  return `${value} · ${event.schedule.timeZone}`;
}

function EventResultsSkeleton() {
  return (
    <div className="event-results-skeleton" aria-hidden="true">
      {[0, 1].map((item) => (
        <div className="event-results-skeleton-card" key={item} />
      ))}
    </div>
  );
}
