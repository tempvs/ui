import React from "react";
import { Button, Form, Modal } from "react-bootstrap";

import PlusActionButton from "../../component/PlusActionButton";
import Spinner from "../../component/Spinner";
import DismissibleCoachmark from "../../component/DismissibleCoachmark";
import ThumbnailList, { ThumbnailEntry } from "../../component/ThumbnailList";
import { MessageFormatter } from "../profileTypes";

type ClubProfile = {
  id: string;
  firstName?: string | null;
};

type ClubProfilesSectionProps = {
  ownerProfileId?: string | number | null;
  isUserProfile: boolean;
  canCreate: boolean;
  visibleClubProfiles: ClubProfile[];
  showEmptyMessage: boolean;
  clubProfilesLoaded: boolean;
  clubProfilesMessage?: React.ReactNode;
  clubProfileCreateVisible: boolean;
  clubProfileCreateError?: unknown;
  clubProfileDeleteTarget?: ClubProfile | null;
  clubProfileDeleteError?: unknown;
  periods: string[];
  getPeriodOptionLabel: (period: string) => string;
  t: MessageFormatter;
  onShowCreate?: React.MouseEventHandler<HTMLElement>;
  onHideCreate?: () => void;
  onCreate?: React.FormEventHandler<HTMLFormElement>;
  onOpenProfile: (profile: ClubProfile) => void;
  onOpenDelete?: (profile: ClubProfile) => void;
  onHideDelete?: () => void;
  onDelete?: React.MouseEventHandler<HTMLButtonElement>;
};

export default function ClubProfilesSection({
  ownerProfileId,
  isUserProfile,
  canCreate,
  visibleClubProfiles,
  showEmptyMessage,
  clubProfilesLoaded,
  clubProfilesMessage,
  clubProfileCreateVisible,
  clubProfileCreateError,
  clubProfileDeleteTarget,
  clubProfileDeleteError,
  periods,
  getPeriodOptionLabel,
  t,
  onShowCreate,
  onHideCreate,
  onCreate,
  onOpenProfile,
  onHideDelete,
  onDelete,
}: ClubProfilesSectionProps) {
  const clubProfileName = clubProfileDeleteTarget
    ? clubProfileDeleteTarget.firstName || ""
    : "";
  const createModalContent: React.ReactNode = (
    <>
      <p className="profile-entry-copy">
        {t(
          "profile.clubProfile.create.subtitle",
          "Create a reenactment profile with its own name, alias, and period.",
        )}
      </p>
      <div className="profile-entry-grid">
        <Form.Group controlId="clubFirstName" className="profile-entry-group">
          <Form.Label className="profile-entry-label">
            {t("profile.field.name", "Name")} *
          </Form.Label>
          <Form.Control
            className="profile-entry-input"
            name="firstName"
            type="text"
            required
          />
        </Form.Group>
        <Form.Group controlId="clubAlias" className="profile-entry-group">
          <Form.Label className="profile-entry-label">
            {t("profile.field.alias", "Alias")}
          </Form.Label>
          <Form.Control
            className="profile-entry-input profile-entry-select"
            name="alias"
            type="text"
          />
        </Form.Group>
        <Form.Group
          controlId="clubPeriod"
          className="profile-entry-group profile-entry-group-full"
        >
          <Form.Label className="profile-entry-label">
            {t("profile.field.period", "Period")} *
          </Form.Label>
          <div className="profile-entry-select-shell">
            <Form.Select
              className="profile-entry-input profile-entry-select"
              name="period"
              required
              defaultValue=""
            >
              <option value="">
                {t("profile.period.choose", "Choose a period")}
              </option>
              {periods.map((period) => (
                <option key={period} value={period}>
                  {getPeriodOptionLabel(period)}
                </option>
              ))}
            </Form.Select>
            <span className="profile-entry-select-caret" aria-hidden="true">
              ▾
            </span>
          </div>
        </Form.Group>
      </div>
      {clubProfileCreateError ? (
        <div className="tempvs-plain-message profile-entry-message profile-entry-message-error">
          {t(
            "profile.clubProfile.create.failed",
            "Unable to create reenactment profile right now.",
          )}
        </div>
      ) : null}
      <div className="profile-entry-actions">
        <Button
          className="profile-entry-submit"
          variant="secondary"
          type="submit"
        >
          {t("profile.clubProfile.create.submit", "Create reenactment profile")}
        </Button>
      </div>
    </>
  );
  const deleteModalContent: React.ReactNode = (
    <>
      <p className="profile-entry-copy mb-0">
        {t("profile.clubProfile.delete.confirm", "Delete {name}?", {
          name:
            clubProfileName ||
            t("profile.clubProfile.delete.fallbackName", "this reenactment profile"),
        })}
      </p>
      {clubProfileDeleteError ? (
        <div className="tempvs-plain-message profile-entry-message profile-entry-message-error">
          {t("profile.clubProfile.delete.failed", "Deletion failed.")}
        </div>
      ) : null}
      <div className="profile-entry-actions profile-entry-actions-end">
        <Button
          className="profile-entry-secondary"
          variant="outline-secondary"
          onClick={onHideDelete}
        >
          {t("profile.action.cancel", "Cancel")}
        </Button>
        <Button
          className="profile-entry-danger"
          variant="danger"
          onClick={onDelete}
        >
          {t("profile.clubProfile.delete.submit", "Delete reenactment profile")}
        </Button>
      </div>
    </>
  );

  return (
    <>
      {isUserProfile && (
        <section className="profile-club-profiles-panel">
          <div className="profile-club-section-header">
            <div>
              <h4 className="profile-club-section-title">
                {t("profile.clubProfiles.title", "Reenactment profiles")}
              </h4>
              <p className="profile-club-section-copy">
                {t(
                  "profile.clubProfiles.subtitle",
                  "Keep separate reenactment identities ready for each period.",
                )}
              </p>
            </div>
            {canCreate && (
              <DismissibleCoachmark
                id={`create-club-profile:${ownerProfileId || "unknown"}`}
                visible={clubProfilesLoaded && showEmptyMessage}
                message="Click here to create a reenactment profile."
              >
                <PlusActionButton
                  onClick={onShowCreate}
                  title={t(
                    "profile.clubProfile.create.title",
                    "Create reenactment profile",
                  )}
                />
              </DismissibleCoachmark>
            )}
          </div>
          {!clubProfilesLoaded && <Spinner />}
          {clubProfilesLoaded && clubProfilesMessage && (
            <div className="tempvs-plain-message profile-entry-message profile-entry-message-error">
              {clubProfilesMessage}
            </div>
          )}
          {clubProfilesLoaded && showEmptyMessage && (
            <div className="profile-club-empty">
              {t("profile.clubProfiles.empty", "No reenactment profiles yet.")}
            </div>
          )}
          {clubProfilesLoaded && visibleClubProfiles.length > 0 && (
            <ThumbnailList items={visibleClubProfiles} getKey={profile => profile.id}
              renderItem={profile => <ThumbnailEntry label={profile.firstName || "Unnamed profile"}
                image={{ resourceType: "profile", resourceId: profile.id }} onClick={() => onOpenProfile(profile)} />} />
          )}
        </section>
      )}

      <Modal
        show={clubProfileCreateVisible}
        onHide={onHideCreate}
        centered
        dialogClassName="profile-entry-dialog"
        contentClassName="profile-entry-modal"
      >
        <Modal.Header closeButton className="profile-entry-modal-header">
          <div className="profile-entry-modal-title-block">
            <span className="profile-entry-modal-kicker">
              {t("profile.clubProfile.kicker", "Reenactment profile")}
            </span>
            <Modal.Title className="profile-entry-modal-title">
              {t("profile.clubProfile.create.title", "Create reenactment profile")}
            </Modal.Title>
          </div>
        </Modal.Header>
        <Modal.Body className="profile-entry-modal-body">
          <div>
            <form onSubmit={onCreate} className="profile-entry-form">
              <div>{createModalContent}</div>
            </form>
          </div>
        </Modal.Body>
      </Modal>

      <Modal
        show={Boolean(clubProfileDeleteTarget)}
        onHide={onHideDelete}
        centered
        dialogClassName="profile-entry-dialog profile-entry-dialog-compact"
        contentClassName="profile-entry-modal"
      >
        <Modal.Header closeButton className="profile-entry-modal-header">
          <div className="profile-entry-modal-title-block">
            <span className="profile-entry-modal-kicker">
              {t("profile.clubProfile.delete.kicker", "Delete")}
            </span>
            <Modal.Title className="profile-entry-modal-title">
              {t("profile.clubProfile.delete.title", "Delete reenactment profile")}
            </Modal.Title>
          </div>
        </Modal.Header>
        <Modal.Body className="profile-entry-modal-body">
          <div>{deleteModalContent}</div>
        </Modal.Body>
      </Modal>
    </>
  );
}
