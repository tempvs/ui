import { type ReactNode, useEffect, useState } from "react";
import { Button, Modal, Spinner } from "react-bootstrap";
import { FaArrowLeft, FaUsers } from "react-icons/fa";
import { getProfileClubs, type Club } from "../../club/clubApi";

const LeftArrowIcon = FaArrowLeft as React.ComponentType;
const ClubsIcon = FaUsers as React.ComponentType;

/**
 * Selects an actual club membership before inheriting an attribute for a club
 * profile. It deliberately has no fallback to the first club: a profile can
 * belong to several clubs and inheritance must be an explicit choice.
 */
export default function ClubLocationInheritanceButton({
  profileId,
  onSelect,
  canInherit = (club) => Boolean(club.locationPlaceId),
  actionLabel = "Inherit club location",
  availableTitle = "Use the location of a club this profile belongs to",
  unavailableTitle = "None of this profile's clubs has a location yet",
  dialogTitle = "Choose a club location",
  dialogDescription = "This club profile belongs to more than one club. Choose the club whose location it should use.",
  renderDetail = (club) => club.location,
}: {
  profileId: string;
  onSelect: (club: Club) => void;
  canInherit?: (club: Club) => boolean;
  actionLabel?: string;
  availableTitle?: string;
  unavailableTitle?: string;
  dialogTitle?: string;
  dialogDescription?: ReactNode;
  renderDetail?: (club: Club) => ReactNode;
}) {
  const [clubs, setClubs] = useState<Club[] | undefined>();
  const [show, setShow] = useState(false);

  useEffect(() => {
    let active = true;
    void getProfileClubs(profileId)
      .then((items) => active && setClubs(items))
      // A failed optional membership lookup must not block direct location
      // editing, and must never expose an inheritance action by accident.
      .catch(() => active && setClubs([]));
    return () => {
      active = false;
    };
  }, [profileId]);

  if (clubs === undefined)
    return <Spinner animation="border" size="sm" aria-label="Loading clubs" />;
  if (!clubs.length) return null;

  const choose = (club: Club) => {
    setShow(false);
    onSelect(club);
  };
  const available = clubs.filter(canInherit);

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="link"
        className="club-location-inheritance-button"
        disabled={!available.length}
        aria-label={actionLabel}
        title={available.length ? availableTitle : unavailableTitle}
        onClick={() => {
          if (available.length === 1) choose(available[0]);
          else if (available.length > 1) setShow(true);
        }}
      >
        <span className="club-location-inheritance-glyph" aria-hidden="true">
          <LeftArrowIcon />
          <ClubsIcon />
        </span>
      </Button>
      <Modal show={show} onHide={() => setShow(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>{dialogTitle}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="text-muted small">{dialogDescription}</p>
          <div className="d-grid gap-2">
            {available.map((club) => (
              <Button
                key={String(club.id)}
                variant="outline-dark"
                className="text-start"
                onClick={() => choose(club)}
              >
                <strong>{club.name}</strong>
                {renderDetail(club) && (
                  <span className="d-block small text-muted">
                    {renderDetail(club)}
                  </span>
                )}
              </Button>
            ))}
          </div>
        </Modal.Body>
      </Modal>
    </>
  );
}
