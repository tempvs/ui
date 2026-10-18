import React, { useEffect, useMemo, useState } from "react";
import { Button, Form } from "react-bootstrap";

import { Club, getProfileClubs } from "../club/clubApi";
import ConfirmationModal from "../component/ConfirmationModal";
import ProfilePicker from "../profile/components/ProfilePicker";
import { Profile } from "../profile/profileTypes";
import {
  applyForEvent,
  cancelEventApplication,
  EventApplication,
} from "./eventApi";

type Props = {
  eventId: string;
  occurrenceId: string;
  profiles: Profile[];
  applications: Record<string, EventApplication | null>;
  busy: boolean;
  onBusy: (busy: boolean) => void;
  onError: (message: string) => void;
  onChange: (profileId: string, application: EventApplication | null) => void;
  onChanged: () => void;
};

type ClubChoice = {
  club: Club;
  profileIds: string[];
};

const statusLabels: Record<EventApplication["status"], string> = {
  CLUB_PENDING: "Waiting for club approval",
  PENDING: "Waiting for event approval",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
  COMPLETED: "Completed",
};

const profileLabel = (profile: Profile) =>
  [profile.firstName, profile.lastName].filter(Boolean).join(" ") ||
  profile.nickName ||
  profile.alias ||
  "Unnamed profile";

const isActive = (application: EventApplication | null | undefined) =>
  Boolean(
    application &&
    !["REJECTED", "WITHDRAWN", "COMPLETED"].includes(application.status),
  );

/** Event application modal actions, with explicit individual and club paths. */
export default function EventApplicationActions({
  eventId,
  occurrenceId,
  profiles,
  applications,
  busy,
  onBusy,
  onError,
  onChange,
  onChanged,
}: Props) {
  const [clubChoices, setClubChoices] = useState<ClubChoice[]>([]);
  const [individualProfileId, setIndividualProfileId] = useState("");
  const [clubId, setClubId] = useState("");
  const [clubProfileId, setClubProfileId] = useState("");
  const [cancelProfileId, setCancelProfileId] = useState<string | null>(null);

  const profileById = useMemo(
    () => new Map(profiles.map((profile) => [String(profile.id), profile])),
    [profiles],
  );
  const profileOptions = useMemo(
    () =>
      profiles.map((profile) => ({
        value: String(profile.id),
        label: profileLabel(profile),
        profile,
      })),
    [profiles],
  );
  const selectedClub =
    clubChoices.find((choice) => String(choice.club.id) === clubId) || null;
  const selectedIndividual =
    profileById.get(individualProfileId) || profiles[0] || null;
  const selectedClubProfile = selectedClub
    ? profileById.get(clubProfileId) ||
      profileById.get(selectedClub.profileIds[0]) ||
      null
    : null;

  useEffect(() => {
    setIndividualProfileId((current) =>
      profiles.some((profile) => String(profile.id) === current)
        ? current
        : String(profiles[0]?.id || ""),
    );
    setClubId("");
    setClubProfileId("");
    if (profiles.length === 0) {
      setClubChoices([]);
      return undefined;
    }
    let active = true;
    void Promise.all(
      profiles.map(async (profile) => ({
        profileId: String(profile.id),
        clubs: await getProfileClubs(profile.id),
      })),
    )
      .then((memberships) => {
        if (!active) return;
        const choices = new Map<string, ClubChoice>();
        memberships.forEach(({ profileId, clubs }) =>
          clubs.forEach((club) => {
            const key = String(club.id);
            const choice = choices.get(key);
            if (choice) choice.profileIds.push(profileId);
            else choices.set(key, { club, profileIds: [profileId] });
          }),
        );
        const values = Array.from(choices.values());
        setClubChoices(values);
        setClubId(values[0] ? String(values[0].club.id) : "");
        setClubProfileId(values[0]?.profileIds[0] || "");
      })
      .catch(() => {
        if (active) {
          setClubChoices([]);
          setClubId("");
          setClubProfileId("");
        }
      });
    return () => {
      active = false;
    };
  }, [profiles]);

  const chooseClub = (value: string) => {
    setClubId(value);
    const choice = clubChoices.find(
      (candidate) => String(candidate.club.id) === value,
    );
    setClubProfileId(choice?.profileIds[0] || "");
  };

  const submit = async (
    profile: Profile,
    participationType: "INDIVIDUAL" | "CLUB",
    selectedClubId?: string,
  ) => {
    onBusy(true);
    onError("");
    try {
      const created = await applyForEvent(
        eventId,
        occurrenceId,
        String(profile.id),
        "TENTATIVE",
        participationType,
        selectedClubId,
      );
      onChange(String(profile.id), created);
      onChanged();
    } catch (caught) {
      onError((caught as Error).message);
    } finally {
      onBusy(false);
    }
  };

  const cancel = async () => {
    if (!cancelProfileId) return;
    onBusy(true);
    onError("");
    try {
      await cancelEventApplication(eventId, occurrenceId, cancelProfileId);
      onChange(cancelProfileId, null);
      setCancelProfileId(null);
      onChanged();
    } catch (caught) {
      onError((caught as Error).message);
    } finally {
      onBusy(false);
    }
  };

  const actionFor = (
    profile: Profile | null,
    participationType: "INDIVIDUAL" | "CLUB",
    selectedClubId?: string,
  ) => {
    if (!profile) return null;
    const application = applications[String(profile.id)];
    if (isActive(application))
      return (
        <>
          <span className="text-muted small">
            {statusLabels[application!.status]}
          </span>
          <Button
            size="sm"
            variant="outline-danger"
            disabled={busy}
            onClick={() => setCancelProfileId(String(profile.id))}
          >
            Cancel participation
          </Button>
        </>
      );
    return (
      <>
        {application && (
          <span className="text-muted small">
            Previous participation ended; you can apply again.
          </span>
        )}
        <Button
          size="sm"
          variant={participationType === "INDIVIDUAL" ? "dark" : "outline-dark"}
          disabled={busy}
          onClick={() =>
            void submit(profile, participationType, selectedClubId)
          }
        >
          {participationType === "INDIVIDUAL"
            ? "Participate individually"
            : "Participate with club"}
        </Button>
      </>
    );
  };

  if (profiles.length === 0) return null;
  return (
    <div className="event-application-actions">
      <div className="event-application-row">
        <ProfilePicker
          options={profileOptions}
          value={individualProfileId}
          onChange={setIndividualProfileId}
          ariaLabel="Profile to participate individually"
          disabled={busy}
        />
        {actionFor(selectedIndividual, "INDIVIDUAL")}
      </div>
      {clubChoices.length > 0 && (
        <>
          <div className="event-application-or" aria-hidden="true">
            <span>Or</span>
          </div>
          <div className="event-application-row">
            <Form.Select
              className="event-application-club-picker"
              size="sm"
              aria-label="Club to participate with"
              value={clubId}
              disabled={busy}
              onChange={(event) => chooseClub(event.target.value)}
            >
              {clubChoices.map((choice) => (
                <option
                  key={String(choice.club.id)}
                  value={String(choice.club.id)}
                >
                  {choice.club.name}
                </option>
              ))}
            </Form.Select>
            {selectedClub && selectedClub.profileIds.length > 1 && (
              <ProfilePicker
                options={selectedClub.profileIds.map((profileId) => {
                  const profile = profileById.get(profileId)!;
                  return {
                    value: profileId,
                    label: profileLabel(profile),
                    profile,
                  };
                })}
                value={clubProfileId}
                onChange={setClubProfileId}
                ariaLabel="Profile representing the club"
                disabled={busy}
              />
            )}
            {actionFor(selectedClubProfile, "CLUB", clubId)}
          </div>
        </>
      )}
      <ConfirmationModal
        show={Boolean(cancelProfileId)}
        title="Cancel participation"
        message="Are you sure you want to cancel this event participation request?"
        confirmLabel="Cancel participation"
        busy={busy}
        onHide={() => {
          if (!busy) setCancelProfileId(null);
        }}
        onConfirm={() => void cancel()}
      />
    </div>
  );
}
