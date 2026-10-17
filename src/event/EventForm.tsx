import React, { FormEvent, useMemo, useState } from "react";
import { Button, Form } from "react-bootstrap";

import PeriodMultiSelect from "../component/PeriodMultiSelect";
import ProfilePicker, {
  ProfilePickerOption,
} from "../profile/components/ProfilePicker";
import { Profile } from "../profile/profileTypes";
import { Period } from "../util/periods";
import { EventDraft } from "./eventApi";
import { browserTimeZone } from "./timeZones";

type Props = {
  profiles: Profile[];
  busy?: boolean;
  onSave: (draft: EventDraft) => Promise<void> | void;
  onCancel: () => void;
};

/** The deliberately compact creation form. Event details are added inline later. */
export default function EventForm({
  profiles,
  busy = false,
  onSave,
  onCancel,
}: Props) {
  const profileOptions = useMemo<ProfilePickerOption[]>(
    () =>
      profiles.map((profile) => ({
        value: String(profile.id),
        label:
          `${profile.firstName || ""} ${profile.lastName || ""}`.trim() ||
          profile.nickName ||
          profile.alias ||
          "Profile",
        profile,
      })),
    [profiles],
  );
  const [ownerProfileId, setOwnerProfileId] = useState(
    profileOptions[0]?.value || "",
  );
  const [name, setName] = useState("");
  const [periods, setPeriods] = useState<Period[]>([]);
  const [error, setError] = useState("");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !ownerProfileId || periods.length === 0) {
      setError("Name, owner, and at least one period are required.");
      return;
    }
    setError("");
    void onSave({
      ownerProfileId,
      name: name.trim(),
      description: null,
      periods,
      autoApproveParticipation: false,
      from: null,
      to: null,
      venuePlaceId: null,
      venuePlaceName: null,
      venueVisibility: "PUBLIC",
      historicalSitePlaceId: null,
      historicalSitePlaceName: null,
      schedule: { kind: "ONE_TIME", timeZone: browserTimeZone() },
    });
  };

  return (
    <Form className="event-form" onSubmit={submit}>
      {error && <p className="text-danger small mb-3">{error}</p>}
      <Form.Group className="mb-3">
        <Form.Label>Name</Form.Label>
        <Form.Control
          value={name}
          maxLength={200}
          autoFocus
          disabled={busy}
          onChange={(event) => setName(event.target.value)}
        />
      </Form.Group>
      <Form.Group className="mb-3">
        <Form.Label>Owner</Form.Label>
        <ProfilePicker
          options={profileOptions}
          value={ownerProfileId}
          onChange={setOwnerProfileId}
          ariaLabel="Event owner profile"
          disabled={busy}
        />
      </Form.Group>
      <Form.Group className="mb-4">
        <Form.Label>Periods</Form.Label>
        <PeriodMultiSelect
          ariaLabel="Event periods"
          selected={periods}
          onChange={setPeriods}
          disabled={busy}
        />
      </Form.Group>
      <div className="d-flex justify-content-end gap-2">
        <Button
          variant="outline-secondary"
          type="button"
          disabled={busy}
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button variant="dark" type="submit" disabled={busy}>
          Create event
        </Button>
      </div>
    </Form>
  );
}
