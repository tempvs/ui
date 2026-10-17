import React, { useState } from "react";
import { Button, Form } from "react-bootstrap";
import { useIntl } from "react-intl";
import { getPeriodLabel, PERIODS, Period } from "../util/periods";
import { ClubDraft } from "./clubApi";
import ProfilePicker, {
  ProfilePickerOption,
} from "../profile/components/ProfilePicker";
import { Profile } from "../profile/profileTypes";

export default function ClubForm({
  initial,
  busy,
  onSave,
  onCancel,
  ownerProfiles = [],
}: {
  initial?: ClubDraft;
  busy: boolean;
  onSave: (draft: ClubDraft) => void;
  onCancel: () => void;
  ownerProfiles?: Profile[];
}) {
  const intl = useIntl();
  const t = (id: string, defaultMessage: string) =>
    intl.formatMessage({ id: `clubs.${id}`, defaultMessage });
  const [draft, setDraft] = useState<ClubDraft>(
    initial || {
      name: "",
      alias: "",
      description: "",
      locationPlaceId: null,
      location: null,
      contactEmail: null,
      period: "OTHER",
      ownerProfileId: ownerProfiles[0]
        ? String(ownerProfiles[0].id)
        : undefined,
    },
  );
  const ownerOptions = ownerProfiles.map<ProfilePickerOption>((profile) => ({
    value: String(profile.id),
    label:
      [profile.firstName, profile.lastName].filter(Boolean).join(" ") ||
      profile.alias ||
      "Profile",
    profile,
  }));
  return (
    <Form
      className="club-form"
      onSubmit={(event) => {
        event.preventDefault();
        onSave(draft);
      }}
    >
      <fieldset disabled={busy}>
        <Form.Group controlId="club-name" className="mb-3">
          <Form.Label>{t("name", "Name")}</Form.Label>
          <Form.Control
            required
            maxLength={120}
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </Form.Group>
        <Form.Group controlId="club-alias" className="mb-3">
          <Form.Label>{t("alias", "Alias")}</Form.Label>
          <Form.Control
            maxLength={40}
            pattern="[a-z][a-z0-9-]{2,39}"
            value={draft.alias || ""}
            onChange={(e) => setDraft({ ...draft, alias: e.target.value })}
          />
          <Form.Text>
            3–40 lowercase letters, numbers, or hyphens; starts with a letter.
          </Form.Text>
        </Form.Group>
        <Form.Group controlId="club-description" className="mb-3">
          <Form.Label>{t("description", "Description")}</Form.Label>
          <Form.Control
            as="textarea"
            className="club-description-input"
            rows={4}
            maxLength={5000}
            value={draft.description || ""}
            onChange={(e) =>
              setDraft({ ...draft, description: e.target.value })
            }
          />
        </Form.Group>
        <div className="club-form-picker-fields">
          {ownerOptions.length > 0 && (
            <Form.Group controlId="club-owner" className="club-form-picker-row">
              <Form.Label>{t("owner", "Profile")}</Form.Label>
              <ProfilePicker
                ariaLabel={t("owner", "Profile")}
                options={ownerOptions}
                value={draft.ownerProfileId || ownerOptions[0]?.value || null}
                onChange={(ownerProfileId) =>
                  setDraft({ ...draft, ownerProfileId })
                }
              />
            </Form.Group>
          )}
          <Form.Group controlId="club-period" className="club-form-picker-row">
            <Form.Label>{t("period", "Period")}</Form.Label>
            <Form.Select
              required
              value={draft.period}
              onChange={(e) =>
                setDraft({ ...draft, period: e.target.value as Period })
              }
            >
              {PERIODS.map((period) => (
                <option key={period} value={period}>
                  {getPeriodLabel(intl, period)}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
        </div>
        <div className="club-actions mt-4">
          <Button variant="secondary" type="submit">
            {t("create", "Create club")}
          </Button>
          <Button variant="outline-secondary" onClick={onCancel}>
            {t("cancel", "Cancel")}
          </Button>
        </div>
      </fieldset>
    </Form>
  );
}
