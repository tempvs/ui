import React, { useEffect, useState } from "react";
import { Alert, Button, Modal } from "react-bootstrap";
import { Link, useNavigate } from "react-router-dom";
import TextFilterInput from "../component/TextFilterInput";
import { formatAppDateTime } from "../i18n/appLocale";
import PeriodMultiSelect from "../component/PeriodMultiSelect";
import HistoricalRangeFilter, {
  type HistoricalYearInput,
} from "../component/HistoricalRangeFilter";
import PlacePickerField from "../component/PlacePickerField";
import type { MapPlace } from "../map/mapApi";
import PageLayout from "../component/PageLayout";
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
    if (
      !textMatch ||
      !venueMatch ||
      !historicalSiteMatch ||
      !periodMatch
    ) {
      return textMatch && venueMatch && historicalSiteMatch && periodMatch;
    }
    return !hasYearFilter || overlapsHistoricalRange(event, range);
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
      <div className="event-heading">
        <div>
          <h1>Events</h1>
          <p>Festivals, meetings, and other themed gatherings.</p>
        </div>
      </div>
      {error && !creating && <Alert variant="danger">{error}</Alert>}
      <>
        <div className="event-search-layout">
          <aside className="event-search-filters">
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
          </aside>
          <div className="event-search-query">
            <TextFilterInput
              value={query}
              onChange={setQuery}
              placeholder="Filter events"
              ariaLabel="Filter events"
            />
            <div className="event-card-grid event-search-results">
              {visible.map((event) => (
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
                    <h2>
                      <Link to={`/events/${event.id}`}>{event.name}</Link>
                    </h2>
                    <time>
                      {event.schedule.startsAt
                        ? `${formatAppDateTime(event.schedule.startsAt)} · ${event.schedule.timeZone}`
                        : "Dates to be announced"}
                    </time>
                    {event.description && <p>{event.description}</p>}
                  </div>
                </article>
              ))}
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
