import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Button, Modal } from "react-bootstrap";
import { Link, useParams } from "react-router-dom";
import {
  fetchClubProfiles,
  fetchCurrentUserInfo,
  fetchProfileById,
  fetchUserProfileByUserId,
} from "../profile/profileApi";
import { Profile } from "../profile/profileTypes";
import { type Period } from "../util/periods";
import type { HistoricalYearInput } from "../component/HistoricalRangeFilter";
import PageLayout from "../component/PageLayout";
import { PageColumn, PageColumns } from "../component/PageColumns";
import SectionBreadcrumb from "../component/SectionBreadcrumb";
import EventManagers from "./EventManagers";
import EventPhotoPanel from "./EventPhotoPanel";
import PhotoAlbumsPanel from "../component/PhotoAlbumsPanel";
import EventFieldsPanel, { EventField } from "./EventFieldsPanel";
import type { MapPlace } from "../map/mapApi";
import EventApplicationActions from "./EventApplicationActions";
import EventPeoplePanels from "./EventPeoplePanels";
import ProfileList from "../profile/components/ProfileList";
import PostPanel from "../post/PostPanel";
import {
  EventApplication,
  deleteEventPrivatePin,
  followEvent,
  getEvent,
  getEventPrivatePin,
  getRestrictedEventVenue,
  getEventApplication,
  getEventFollowState,
  TempvsEvent,
  unfollowEvent,
  updateEvent,
  saveEventPrivatePin,
} from "./eventApi";
import "./events.css";

export default function EventPage() {
  const { eventId = "" } = useParams();
  const [item, setItem] = useState<TempvsEvent | null>(null);
  const [privatePin, setPrivatePin] = useState<{
    latitude: number;
    longitude: number;
    label?: string | null;
  } | null>(null);
  const [owner, setOwner] = useState<Profile | null>(null);
  const [ownedProfiles, setOwnedProfiles] = useState<Profile[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [applyOpen, setApplyOpen] = useState(false);
  const [followOpen, setFollowOpen] = useState(false);
  const [following, setFollowing] = useState<Record<string, boolean>>({});
  const [applications, setApplications] = useState<
    Record<string, EventApplication | null>
  >({});
  const [peopleRevision, setPeopleRevision] = useState(0);
  const [fieldStatuses, setFieldStatuses] = useState<
    Partial<Record<EventField, "saving" | "saved" | "error">>
  >({});
  const eventRef = useRef<TempvsEvent | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    getEvent(eventId, controller.signal)
      .then((value) => {
        setItem(value);
        eventRef.current = value;
        fetchProfileById(value.ownerProfileId, {
          onSuccess: setOwner,
          onError: () => undefined,
          onMissing: () => undefined,
        });
      })
      .catch((error) => setError(error.message));
    return () => controller.abort();
  }, [eventId]);

  useEffect(
    () =>
      fetchCurrentUserInfo((result) => {
        if (!result.currentUserId) return;
        let personal: Profile | null = null,
          clubs: Profile[] = [];
        const finish = () =>
          setOwnedProfiles([...(personal ? [personal] : []), ...clubs]);
        fetchUserProfileByUserId(result.currentUserId, {
          onSuccess: (value) => {
            personal = value;
            finish();
          },
          onMissing: finish,
          onError: finish,
        });
        fetchClubProfiles(result.currentUserId, {
          onSuccess: (values) => {
            clubs = values;
            finish();
          },
          onError: finish,
        });
      }),
    [],
  );

  const canManage = Boolean(
    item &&
    ownedProfiles.some(
      (profile) =>
        String(profile.id) === item.ownerProfileId ||
        item.adminProfileIds.includes(String(profile.id)),
    ),
  );
  const restrictedVenueEventId =
    item?.venueVisibility === "PARTICIPANTS" ? item.id : null;
  const privatePinEventId = canManage ? item?.id : undefined;
  useEffect(() => {
    let active = true;
    if (!privatePinEventId) {
      setPrivatePin(null);
      return () => {
        active = false;
      };
    }
    void getEventPrivatePin(privatePinEventId)
      .then((pin) => {
        if (active) setPrivatePin(pin);
      })
      .catch(() => {
        if (active) setPrivatePin(null);
      });
    return () => {
      active = false;
    };
  }, [privatePinEventId]);
  useEffect(() => {
    if (!restrictedVenueEventId) return;
    let active = true;
    void getRestrictedEventVenue(restrictedVenueEventId)
      .then((venue) => {
        if (!active) return;
        const current = eventRef.current;
        if (current?.id === restrictedVenueEventId)
          replaceItem({ ...current, ...venue });
      })
      // Public visitors intentionally cannot discover a restricted venue.
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [restrictedVenueEventId]);
  const occurrence = item?.upcomingOccurrences?.[0];
  const applicantProfiles = useMemo(
    () => ownedProfiles.filter((profile) => profile.type === "CLUB"),
    [ownedProfiles],
  );
  useEffect(() => {
    if (!item || ownedProfiles.length === 0) return;
    let active = true;
    Promise.all(
      ownedProfiles.map(
        async (profile) =>
          [
            String(profile.id),
            await getEventFollowState(item.id, String(profile.id)),
          ] as const,
      ),
    )
      .then((values) => {
        if (active) setFollowing(Object.fromEntries(values));
      })
      .catch(() => undefined);
    if (occurrence)
      Promise.all(
        applicantProfiles.map(
          async (profile) =>
            [
              String(profile.id),
              await getEventApplication(
                item.id,
                occurrence.id,
                String(profile.id),
              ),
            ] as const,
        ),
      )
        .then((values) => {
          if (active) setApplications(Object.fromEntries(values));
        })
        .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [item, occurrence, ownedProfiles, applicantProfiles]);

  const toggleFollow = async (profile: Profile) => {
    const profileId = String(profile.id);
    setBusy(true);
    setError("");
    try {
      if (following[profileId]) await unfollowEvent(item!.id, profileId);
      else await followEvent(item!.id, profileId);
      setFollowing((current) => ({
        ...current,
        [profileId]: !current[profileId],
      }));
      setPeopleRevision((value) => value + 1);
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const replaceItem = (value: TempvsEvent) => {
    eventRef.current = value;
    setItem(value);
  };
  const updateField = (field: EventField, value: string | string[]) => {
    const current = eventRef.current;
    if (!current) return;
    const recurringSchedule = () => ({
      ...current.schedule,
      kind: "RECURRING" as const,
      recurrence: current.schedule.recurrence || {
        frequency: "WEEKLY" as const,
        interval: 1,
        count: 4,
      },
    });
    let next = current;
    if (field === "name") next = { ...current, name: String(value) };
    if (field === "description")
      next = { ...current, description: String(value) || null };
    if (field === "periods") next = { ...current, periods: value as Period[] };
    if (field === "kind") {
      next =
        String(value) === "RECURRING"
          ? { ...current, schedule: recurringSchedule() }
          : {
              ...current,
              schedule: {
                kind: "ONE_TIME",
                startsAt: current.schedule.startsAt,
                endsAt: current.schedule.endsAt,
                timeZone: current.schedule.timeZone,
              },
            };
    }
    if (field === "startsAt" || field === "endsAt") {
      const date = new Date(String(value));
      if (Number.isNaN(date.getTime())) return;
      next = {
        ...current,
        schedule: { ...current.schedule, [field]: date.toISOString() },
      };
    }
    if (field === "timeZone") {
      next = {
        ...current,
        schedule: { ...current.schedule, timeZone: String(value) },
      };
    }
    if (field === "frequency" || field === "interval" || field === "count") {
      const schedule = recurringSchedule();
      next = {
        ...current,
        schedule: {
          ...schedule,
          recurrence: {
            ...schedule.recurrence,
            [field]:
              field === "frequency"
                ? (value as "DAILY" | "WEEKLY" | "MONTHLY")
                : Math.max(1, Number(value) || 1),
          },
        },
      };
    }
    replaceItem(next);
  };
  const saveField = async (field: EventField) => {
    const current = eventRef.current;
    if (!current) return;
    if (
      current.schedule.startsAt &&
      current.schedule.endsAt &&
      new Date(current.schedule.endsAt).getTime() <=
        new Date(current.schedule.startsAt).getTime()
    ) {
      setFieldStatuses((statuses) => ({ ...statuses, endsAt: "error" }));
      return;
    }
    setFieldStatuses((statuses) => ({ ...statuses, [field]: "saving" }));
    setBusy(true);
    setError("");
    try {
      const saved = await updateEvent(
        current.id,
        {
          ownerProfileId: current.ownerProfileId,
          name: current.name,
          description: current.description,
          periods: current.periods,
          autoApproveParticipation: current.autoApproveParticipation || false,
          from: current.from || null,
          to: current.to || null,
          venuePlaceId: current.venuePlaceId || null,
          venuePlaceName: current.venuePlaceName || null,
          venueVisibility: current.venueVisibility || "PUBLIC",
          historicalSitePlaceId: current.historicalSitePlaceId || null,
          historicalSitePlaceName: current.historicalSitePlaceName || null,
          schedule: current.schedule,
        },
        current.version,
      );
      replaceItem(saved);
      setFieldStatuses((statuses) => ({ ...statuses, [field]: "saved" }));
    } catch (error) {
      const message = (error as Error).message;
      if (message.includes("schedule.endsAt must be after schedule.startsAt")) {
        setFieldStatuses((statuses) => ({ ...statuses, endsAt: "error" }));
      } else {
        setError(message);
        setFieldStatuses((statuses) => ({ ...statuses, [field]: "error" }));
      }
    } finally {
      setBusy(false);
    }
  };
  const updateVenue = (place: MapPlace | null) => {
    const current = eventRef.current;
    if (!current) return;
    replaceItem({
      ...current,
      venuePlaceId: place?.id || null,
      venuePlaceName: place?.matchedName || place?.canonicalName || null,
    });
    void saveField("venue");
  };
  const updateHistoricalSite = (place: MapPlace | null) => {
    const current = eventRef.current;
    if (!current) return;
    replaceItem({
      ...current,
      historicalSitePlaceId: place?.id || null,
      historicalSitePlaceName:
        place?.matchedName || place?.canonicalName || null,
    });
    void saveField("historicalSite");
  };
  const updateRange = (from: HistoricalYearInput, to: HistoricalYearInput) => {
    const current = eventRef.current;
    if (!current) return;
    replaceItem({
      ...current,
      from: from.year ? { year: Number(from.year), era: from.era } : null,
      to: to.year ? { year: Number(to.year), era: to.era } : null,
    });
  };
  if (error && !item)
    return (
      <PageLayout className="events-page" header={{ title: "Events" }}>
        <Alert variant="danger">{error}</Alert>
        <Link to="/events">All events</Link>
      </PageLayout>
    );
  if (!item)
    return (
      <PageLayout className="events-page" header={{ title: "Events" }}>
        <p role="status">Loading event…</p>
      </PageLayout>
    );
  return (
    <PageLayout
      className="events-page event-detail-page"
      header={{
        title: (
          <SectionBreadcrumb
            items={[{ label: "Events", to: "/events" }, { label: item.name }]}
          />
        ),
        rightContent: (
          <div className="event-actions mt-0">
            {applicantProfiles.length > 0 && (
              <Button
                variant="outline-dark"
                disabled={!occurrence}
                onClick={() => setApplyOpen(true)}
              >
                Apply for event
              </Button>
            )}
            {ownedProfiles.length > 0 && (
              <Button
                variant="outline-dark"
                onClick={() => setFollowOpen(true)}
              >
                Follow event
              </Button>
            )}
            {canManage && (
              <Link
                className="btn btn-outline-dark"
                to={`/events/${item.id}/admin`}
              >
                Admin actions
              </Link>
            )}
          </div>
        ),
      }}
    >
      {error && <Alert variant="danger">{error}</Alert>}
      <article className="event-detail">
        <PageColumns variant="three" className="event-page-layout">
          <PageColumn>
            <EventPhotoPanel
              eventId={item.id}
              name={item.name}
              editable={canManage}
            />
            <PhotoAlbumsPanel
              targetType="event"
              targetId={item.id}
              editable={canManage}
            />
            <EventPeoplePanels
              eventId={item.id}
              canManage={canManage}
              revision={peopleRevision}
              showApprovals={false}
              onChanged={() => setPeopleRevision((value) => value + 1)}
            />
          </PageColumn>
          <PageColumn>
            <EventFieldsPanel
              event={item}
              // Keep every field in its inline-editable DOM while a save is
              // in flight. Toggling this flag made the complete panel switch
              // to a separate read-only rendering path, which changed title
              // and description line boxes and visibly shifted the layout.
              editable={canManage}
              statuses={fieldStatuses}
              onChange={updateField}
              onBlur={saveField}
              onRangeChange={updateRange}
              onRangeBlur={() => void saveField("periods")}
              onVenueChange={updateVenue}
              privatePin={privatePin}
              onPrivatePinChange={
                canManage
                  ? async (pin) => {
                      if (!item) return false;
                      try {
                        if (pin)
                          setPrivatePin(
                            await saveEventPrivatePin(item.id, pin),
                          );
                        else {
                          await deleteEventPrivatePin(item.id);
                          setPrivatePin(null);
                        }
                        return true;
                      } catch {
                        // Preserve the last confirmed private location.
                        return false;
                      }
                    }
                  : undefined
              }
              onHistoricalSiteChange={updateHistoricalSite}
            />
            <PostPanel
              targetType="EVENT"
              targetId={item.id}
              canCreate={canManage}
            />
          </PageColumn>
          <PageColumn>
            <EventManagers
              event={item}
              owner={owner}
              canManageAdmins={false}
              ownedProfiles={ownedProfiles}
              onChange={replaceItem}
            />
          </PageColumn>
        </PageColumns>
        {/*
                <ul className="event-occurrences">
          {new Date(item.schedule.startsAt).toLocaleString()} –{" "}
          {new Date(item.schedule.endsAt).toLocaleString()} (
          {item.schedule.timeZone})
        </p>
        {item.schedule.kind === "RECURRING" && (
          <p>
            Repeats every {item.schedule.recurrence?.interval}{" "}
            {item.schedule.recurrence?.frequency.toLocaleLowerCase()}.
          </p>
        )}
        <h2>Occurrences</h2>
        <ul className="event-occurrences">
          {(item.upcomingOccurrences || []).map((occurrence) => (
            <li key={occurrence.id}>
              <time>{new Date(occurrence.startsAt).toLocaleString()}</time>
              <span>{occurrence.status}</span>
            </li>
          ))}
        </ul>
        <EventManagers
          event={item}
          owner={owner}
          canManageAdmins={canManageAdmins}
          ownedProfiles={ownedProfiles}
          onChange={setItem}
        />
        <EventPeoplePanels
          eventId={item.id}
          canManage={canManage}
          revision={peopleRevision}
          showApprovals={false}
          onChanged={() => setPeopleRevision((value) => value + 1)}
        />
        <PostPanel
          targetType="EVENT"
          targetId={item.id}
          canCreate={canManage}
        />
        */}
      </article>
      <Modal
        show={applyOpen}
        onHide={() => {
          if (!busy) setApplyOpen(false);
        }}
        centered
        size="lg"
      >
        <Modal.Header closeButton>
          <Modal.Title>Apply for event</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {occurrence && (
            <EventApplicationActions
              eventId={item.id}
              occurrenceId={occurrence.id}
              profiles={applicantProfiles}
              applications={applications}
              busy={busy}
              onBusy={setBusy}
              onError={setError}
              onChange={(profileId, application) =>
                setApplications((current) => ({
                  ...current,
                  [profileId]: application,
                }))
              }
              onChanged={() => setPeopleRevision((value) => value + 1)}
            />
          )}
        </Modal.Body>
      </Modal>
      <Modal
        show={followOpen}
        onHide={() => {
          if (!busy) setFollowOpen(false);
        }}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>Follow event</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <ProfileList
            profiles={ownedProfiles}
            renderActions={(profile) => (
              <Button
                size="sm"
                variant={
                  following[String(profile.id)] ? "outline-danger" : "dark"
                }
                disabled={busy}
                onClick={() => toggleFollow(profile)}
              >
                {following[String(profile.id)] ? "Unfollow" : "Follow"}
              </Button>
            )}
          />
        </Modal.Body>
      </Modal>
    </PageLayout>
  );
}
