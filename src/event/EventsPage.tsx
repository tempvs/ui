import React, { useEffect, useState } from "react";
import { Alert, Button, Form } from "react-bootstrap";
import { useIntl } from "react-intl";
import { Link, useNavigate } from "react-router-dom";
import TextFilterInput from "../component/TextFilterInput";
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
import { getPeriodLabel, PERIODS, PeriodBadge } from "../util/periods";
import EventForm from "./EventForm";
import { createEvent, EventDraft, listEvents, TempvsEvent } from "./eventApi";
import {
  overlapsHistoricalRange,
  rangeFromInputs,
} from "../search/publicSearchFilterContract";
import "./events.css";

export default function EventsPage() {
  const navigate = useNavigate();
  const intl = useIntl();
  const [events, setEvents] = useState<TempvsEvent[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [query, setQuery] = useState("");
  const [period, setPeriod] = useState("");
  const [rangeEnabled, setRangeEnabled] = useState(false);
  const [from, setFrom] = useState<HistoricalYearInput>({
    year: "",
    era: "AD",
  });
  const [to, setTo] = useState<HistoricalYearInput>({ year: "", era: "AD" });
  const [venue, setVenue] = useState<MapPlace | null>(null);
  const [placeRole, setPlaceRole] = useState<"VENUE" | "HISTORICAL_SITE">(
    "VENUE",
  );
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
  const visible = events.filter((event) => {
    if (!normalized && !period && !rangeEnabled && !venue) return true;
    const textMatch =
      !normalized ||
      `${event.name} ${event.description || ""}`
        .toLocaleLowerCase()
        .includes(normalized);
    const placeMatch =
      !venue ||
      (placeRole === "VENUE"
        ? event.venuePlaceId === venue.id
        : event.historicalSitePlaceId === venue.id);
    const periodMatch = !period || event.periods.includes(period as never);
    if (!textMatch || !placeMatch || !periodMatch || !rangeEnabled)
      return textMatch && placeMatch && periodMatch;
    return overlapsHistoricalRange(event, range);
  });

  return (
    <PageLayout
      className="events-page"
      header={{
        title: <SectionBreadcrumb items={[{ label: "Events" }]} />,
        rightContent:
          profiles.length > 0 && !creating ? (
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
      {error && <Alert variant="danger">{error}</Alert>}
      {creating ? (
        <section className="event-panel">
          <h2>Create event</h2>
          <EventForm
            profiles={profiles}
            busy={busy}
            onSave={save}
            onCancel={() => setCreating(false)}
          />
        </section>
      ) : (
        <>
          <div className="event-search-layout">
            <aside className="event-search-filters">
              <Form.Select
                aria-label="Period"
                value={period}
                onChange={(event) => setPeriod(event.target.value)}
              >
                <option value="">All periods</option>
                {PERIODS.map((value) => (
                  <option key={value} value={value}>
                    {getPeriodLabel(intl, value)}
                  </option>
                ))}
              </Form.Select>
              <div className="event-search-place-row">
                <PlacePickerField
                  label={placeRole === "VENUE" ? "Venue" : "Historical site"}
                  value={venue}
                  editable
                  onChange={setVenue}
                  labelWidth="3rem"
                  fieldMaxWidth="15rem"
                  className="mb-0"
                />
                <Form.Select
                  aria-label="Event location role"
                  size="sm"
                  value={placeRole}
                  onChange={(event) => {
                    setPlaceRole(
                      event.target.value as "VENUE" | "HISTORICAL_SITE",
                    );
                    setVenue(null);
                  }}
                >
                  <option value="VENUE">Venue</option>
                  <option value="HISTORICAL_SITE">Historical site</option>
                </Form.Select>
              </div>
              <HistoricalRangeFilter
                enabled={rangeEnabled}
                from={from}
                to={to}
                onEnabledChange={setRangeEnabled}
                onFromChange={setFrom}
                onToChange={setTo}
                onValueEntered={() => setRangeEnabled(true)}
                label="Years"
                alwaysShowFields
                compact
                inlineToggle
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
                    {new Date(event.schedule.startsAt).toLocaleString()} ·{" "}
                    {event.schedule.timeZone}
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
      )}
    </PageLayout>
  );
}
