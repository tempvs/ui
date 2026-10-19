import React, { useEffect, useState } from "react";
import { Alert, Button, Form } from "react-bootstrap";
import { Link, useNavigate, useParams } from "react-router-dom";
import ConfirmationModal from "../component/ConfirmationModal";
import AdministrationTabs from "../component/AdministrationTabs";
import PageLayout from "../component/PageLayout";
import SectionBreadcrumb from "../component/SectionBreadcrumb";
import {
  fetchClubProfiles,
  fetchCurrentUserInfo,
  fetchProfileById,
  fetchUserProfileByUserId,
} from "../profile/profileApi";
import { Profile } from "../profile/profileTypes";
import EventManagers from "./EventManagers";
import EventPeoplePanels from "./EventPeoplePanels";
import {
  deleteEvent,
  EventDraft,
  getEvent,
  TempvsEvent,
  updateEvent,
} from "./eventApi";
import "./events.css";

export default function EventAdminPage() {
  const { eventId = "" } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState<TempvsEvent | null>(null);
  const [owner, setOwner] = useState<Profile | null>(null);
  const [ownedProfiles, setOwnedProfiles] = useState<Profile[]>([]);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("requests");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    getEvent(eventId, controller.signal)
      .then((value) => {
        setEvent(value);
        fetchProfileById(value.ownerProfileId, {
          onSuccess: setOwner,
          onMissing: () => undefined,
          onError: () => undefined,
        });
      })
      .catch((caught) => {
        if ((caught as Error).name !== "AbortError")
          setError((caught as Error).message);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [eventId]);

  useEffect(
    () =>
      fetchCurrentUserInfo((result) => {
        if (!result.currentUserId) return;
        let personal: Profile | null = null;
        let clubs: Profile[] = [];
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
    event &&
    ownedProfiles.some(
      (profile) =>
        String(profile.id) === event.ownerProfileId ||
        event.adminProfileIds.includes(String(profile.id)),
    ),
  );
  const isOwner = Boolean(
    event &&
    ownedProfiles.some(
      (profile) => String(profile.id) === event.ownerProfileId,
    ),
  );

  const remove = async () => {
    if (!event) return;
    setBusy(true);
    setError("");
    try {
      await deleteEvent(event.id);
      navigate("/events", { replace: true });
    } catch (caught) {
      setError((caught as Error).message);
      setDeleting(false);
      setBusy(false);
    }
  };

  const setAutoApproveParticipation = async (
    autoApproveParticipation: boolean,
  ) => {
    if (!event) return;
    setBusy(true);
    setError("");
    try {
      const draft: EventDraft = {
        ownerProfileId: event.ownerProfileId,
        name: event.name,
        description: event.description,
        periods: event.periods,
        autoApproveParticipation,
        from: event.from || null,
        to: event.to || null,
        venuePlaceId: event.venuePlaceId || null,
        venuePlaceName: event.venuePlaceName || null,
        venueVisibility: event.venueVisibility || "PUBLIC",
        historicalSitePlaceId: event.historicalSitePlaceId || null,
        historicalSitePlaceName: event.historicalSitePlaceName || null,
        schedule: event.schedule,
      };
      setEvent(await updateEvent(event.id, draft, event.version));
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageLayout
      className="events-page"
      header={{
        title: (
          <SectionBreadcrumb
            items={[
              { label: "Events", to: "/events" },
              { label: event?.name || "Event", to: `/events/${eventId}` },
              { label: "Administration" },
            ]}
          />
        ),
        rightContent: (
          <Link className="btn btn-outline-dark" to={`/events/${eventId}`}>
            View event
          </Link>
        ),
      }}
    >
      {error && (
        <Alert variant="danger" className="mt-3">
          {error}
        </Alert>
      )}
      {loading ? (
        <p role="status">Loading event administration…</p>
      ) : !event ? null : !canManage ? (
        <Alert variant="danger" className="mt-3">
          Event administration is available only to the owner and event admins.
        </Alert>
      ) : (
        <article className="event-panel event-detail mt-3">
          <div className="event-heading">
            <div>
              <h1>Admin actions</h1>
              <p className="text-muted mb-0">
                Review participation requests and manage {event.name}.
              </p>
            </div>
          </div>
          <AdministrationTabs
            ariaLabel="Event administration"
            activeTab={activeTab}
            onSelect={setActiveTab}
            tabs={[
              { id: "requests", label: "Requests" },
              { id: "members", label: "Members" },
              { id: "followers", label: "Followers" },
              { id: "settings", label: "Administration" },
              { id: "danger", label: "Danger zone", disabled: !isOwner },
            ]}
          />
          {activeTab === "requests" && (
            <>
              <EventPeoplePanels
                eventId={event.id}
                canManage
                revision={revision}
                showPeople={false}
                showApprovals
                onChanged={() => setRevision((value) => value + 1)}
              />
            </>
          )}
          {activeTab === "members" && (
            <>
              <EventPeoplePanels
                eventId={event.id}
                canManage
                revision={revision}
                showPeople={false}
                showApprovals={false}
                showParticipants
                onChanged={() => setRevision((value) => value + 1)}
              />
            </>
          )}
          {activeTab === "followers" && (
            <>
              <EventPeoplePanels
                eventId={event.id}
                canManage
                revision={revision}
                showPeople={false}
                showApprovals={false}
                showFollowers
                onChanged={() => setRevision((value) => value + 1)}
              />
            </>
          )}
          {activeTab === "settings" && (
            <>
              <section className="club-panel event-approval-settings">
                <h2>Participation</h2>
                <Form.Check
                  id="event-auto-approve-participation"
                  type="checkbox"
                  label="Automatically approve participation"
                  checked={event.autoApproveParticipation === true}
                  disabled={!canManage || busy}
                  onChange={(input) =>
                    void setAutoApproveParticipation(input.target.checked)
                  }
                />
                <p className="text-muted mb-0">
                  Club participation still requires approval from that club.
                  Once approved by the club, event approval is skipped.
                </p>
              </section>
              <EventManagers
                event={event}
                owner={owner}
                canManageAdmins={isOwner}
                ownedProfiles={ownedProfiles}
                onChange={setEvent}
                onOwnerChange={setOwner}
                mode="administration"
              />
            </>
          )}
          {activeTab === "danger" && isOwner && (
            <>
              <EventManagers
                event={event}
                owner={owner}
                canManageAdmins={isOwner}
                ownedProfiles={ownedProfiles}
                onChange={setEvent}
                onOwnerChange={setOwner}
                mode="danger"
              />
              <section className="club-panel border-danger mt-3">
                <h2>Danger zone</h2>
                <p className="text-muted">
                  Deleting an event is permanent and cannot be undone.
                </p>
                <Button
                  variant="outline-danger"
                  disabled={busy}
                  onClick={() => setDeleting(true)}
                >
                  Delete event
                </Button>
              </section>
            </>
          )}
        </article>
      )}
      <ConfirmationModal
        show={deleting}
        title="Delete event"
        message="Are you sure you want to delete this event?"
        confirmLabel="Delete event"
        busy={busy}
        onConfirm={() => void remove()}
        onHide={() => {
          if (!busy) setDeleting(false);
        }}
      />
    </PageLayout>
  );
}
