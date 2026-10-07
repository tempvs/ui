import React, { useEffect, useState } from "react";
import { Alert, Button } from "react-bootstrap";
import { Link, useNavigate } from "react-router-dom";
import TextFilterInput from "../component/TextFilterInput";
import HistoricalRangeFilter, {
  type HistoricalYearInput,
} from "../component/HistoricalRangeFilter";
import PlacePickerField from "../component/PlacePickerField";
import type { MapPlace } from "../map/mapApi";
import PageLayout from "../component/PageLayout";
import { DEFAULT_HOURGLASS_IMAGE_SRC } from "../component/DefaultHourglassImage";
import RefreshingImage from "../image/RefreshingImage";
import {
  fetchClubProfiles,
  fetchCurrentUserInfo,
  fetchUserProfileByUserId,
} from "../profile/profileApi";
import { Profile } from "../profile/profileTypes";
import { PeriodBadge } from "../util/periods";
import EventForm from "./EventForm";
import { createEvent, EventDraft, listEvents, TempvsEvent } from "./eventApi";
import "./events.css";

export default function EventsPage() {
  const navigate = useNavigate();
  const [events, setEvents] = useState<TempvsEvent[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [query, setQuery] = useState("");
  const [rangeEnabled, setRangeEnabled] = useState(false);
  const [from, setFrom] = useState<HistoricalYearInput>({
    year: "",
    era: "AD",
  });
  const [to, setTo] = useState<HistoricalYearInput>({ year: "", era: "AD" });
  const [venue, setVenue] = useState<MapPlace | null>(null);
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
  const ordinal = (value?: { year: number; era: "BC" | "AD" } | null) =>
    !value ? null : value.era === "BC" ? 1 - value.year : value.year;
  const visible = events.filter((event) => {
    if (!normalized && !rangeEnabled && !venue) return true;
    const textMatch =
      !normalized ||
      `${event.name} ${event.description || ""}`
        .toLocaleLowerCase()
        .includes(normalized);
    const venueMatch = !venue || event.venuePlaceId === venue.id;
    if (!textMatch || !venueMatch || !rangeEnabled)
      return textMatch && venueMatch;
    if (!event.from && !event.to) return true;
    const lower = from.year
      ? ordinal({ year: Number(from.year), era: from.era })
      : null;
    const upper = to.year
      ? ordinal({ year: Number(to.year), era: to.era })
      : null;
    const eventFrom = ordinal(event.from);
    const eventTo = ordinal(event.to);
    return (
      (eventTo === null || lower === null || eventTo >= lower) &&
      (upper === null || eventFrom === null || eventFrom <= upper)
    );
  });

  return (
    <PageLayout
      className="events-page"
      header={{
        title: "Events",
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
          <div className="event-search-row">
            <div style={{ minWidth: "16rem", flex: "1 1 16rem" }}>
              <TextFilterInput
                value={query}
                onChange={setQuery}
                placeholder="Filter events"
                ariaLabel="Filter events"
              />
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
            <PlacePickerField
              label="Venue"
              value={venue}
              editable
              onChange={setVenue}
              labelWidth="3rem"
              fieldMaxWidth="15rem"
              className="mb-0"
            />
          </div>
          <div className="event-card-grid">
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
        </>
      )}
    </PageLayout>
  );
}
