import React from "react";
import { Button, Col, Container, Form, Row } from "react-bootstrap";

import { MessageFormatter } from "../profileTypes";

type CreateProfileFormProps = {
  firstName?: string;
  lastName?: string;
  isErrorMessage?: boolean;
  t: MessageFormatter;
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
  onSubmit?: React.FormEventHandler<HTMLFormElement>;
};

export default function CreateProfileForm({
  firstName,
  lastName,
  isErrorMessage,
  t,
  onChange,
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
