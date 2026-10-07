import React from "react";
import { Button, Col, Container, Form, Row } from "react-bootstrap";

import { MessageFormatter } from "../profileTypes";
import PlacePickerField from "../../component/PlacePickerField";

type CreateProfileFormProps = {
  firstName?: string;
  lastName?: string;
  nickName?: string;
  profileEmail?: string;
  locationPlaceId?: string | null;
  location?: string;
  alias?: string;
  isErrorMessage?: boolean;
  t: MessageFormatter;
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
  onLocationChange?: (
    place: { id: string; canonicalName: string } | null,
  ) => void;
  onSubmit?: React.FormEventHandler<HTMLFormElement>;
};

export default function CreateProfileForm({
  firstName,
  lastName,
  nickName,
  profileEmail,
  locationPlaceId,
  location,
  alias,
  isErrorMessage,
  t,
  onChange,
  onLocationChange,
  onSubmit,
}: CreateProfileFormProps) {
  return (
    <Container fluid className="profile-create-shell px-4 px-xl-5">
      <Row className="justify-content-center">
        <Col xl={8} lg={9}>
          <div className="profile-create-hero">
            <span className="profile-create-kicker">
              {t("profile.create.kicker", "Profile")}
            </span>
            <h2 className="profile-create-title">
              {t("profile.create.title", "Create your profile")}
            </h2>
            <p className="profile-create-copy">
              {t(
                "profile.create.subtitle",
                "Your user profile does not exist yet. Complete the required fields to continue.",
              )}
            </p>
          </div>
        </Col>
      </Row>
      <Row className="justify-content-center">
        <Col xl={8} lg={9}>
          <div className="profile-create-panel">
            <Form onSubmit={onSubmit} className="profile-entry-form">
              <div className="profile-entry-grid">
                <Form.Group
                  controlId="firstName"
                  className="profile-entry-group"
                >
                  <Form.Label className="profile-entry-label">
                    {t("profile.field.firstName", "First name")} *
                  </Form.Label>
                  <Form.Control
                    className="profile-entry-input"
                    name="firstName"
                    type="text"
                    required
                    value={firstName}
                    onChange={onChange}
                  />
                </Form.Group>
                <Form.Group
                  controlId="lastName"
                  className="profile-entry-group"
                >
                  <Form.Label className="profile-entry-label">
                    {t("profile.field.lastName", "Last name")} *
                  </Form.Label>
                  <Form.Control
                    className="profile-entry-input"
                    name="lastName"
                    type="text"
                    required
                    value={lastName}
                    onChange={onChange}
                  />
                </Form.Group>
                <Form.Group
                  controlId="nickName"
                  className="profile-entry-group"
                >
                  <Form.Label className="profile-entry-label">
                    {t("profile.field.nickName", "Nick name")}
                  </Form.Label>
                  <Form.Control
                    className="profile-entry-input"
                    name="nickName"
                    type="text"
                    value={nickName}
                    onChange={onChange}
                  />
                </Form.Group>
                <Form.Group
                  controlId="profileEmail"
                  className="profile-entry-group"
                >
                  <Form.Label className="profile-entry-label">
                    {t("profile.field.email", "Profile email")}
                  </Form.Label>
                  <Form.Control
                    className="profile-entry-input"
                    name="profileEmail"
                    type="email"
                    value={profileEmail}
                    onChange={onChange}
                  />
                </Form.Group>
                <div className="profile-entry-group">
                  <Form.Label className="profile-entry-label">
                    {t("profile.field.location", "Location")}
                  </Form.Label>
                  <PlacePickerField
                    label={null}
                    editable
                    value={
                      locationPlaceId
                        ? { id: locationPlaceId, canonicalName: location || "" }
                        : null
                    }
                    onChange={onLocationChange || (() => undefined)}
                    className="mb-0"
                    labelWidth="0"
                    fieldMaxWidth="100%"
                  />
                  <input
                    type="hidden"
                    name="locationPlaceId"
                    value={locationPlaceId || ""}
                  />
                  <input type="hidden" name="location" value={location || ""} />
                </div>
                <Form.Group controlId="alias" className="profile-entry-group">
                  <Form.Label className="profile-entry-label">
                    {t("profile.field.alias", "Alias")}
                  </Form.Label>
                  <Form.Control
                    className="profile-entry-input"
                    name="alias"
                    type="text"
                    value={alias}
                    onChange={onChange}
                  />
                </Form.Group>
              </div>
              {isErrorMessage && (
                <div className="tempvs-plain-message profile-entry-message profile-entry-message-error">
                  {t(
                    "profile.create.failed",
                    "Unable to create profile right now.",
                  )}
                </div>
              )}
              <div className="profile-entry-actions">
                <Button
                  className="profile-entry-submit"
                  variant="secondary"
                  type="submit"
                >
                  {t("profile.create.submit", "Create profile")}
                </Button>
              </div>
            </Form>
          </div>
        </Col>
      </Row>
    </Container>
  );
}
