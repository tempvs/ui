import { useEffect, useState } from "react";
import { Button, Modal, Spinner } from "react-bootstrap";
import { getProfileClubs, type Club } from "../../club/clubApi";

/**
 * Selects an actual club membership before applying its location to a club
 * profile.  It deliberately has no fallback to the first club: a profile can
 * belong to several clubs and location inheritance must be an explicit choice.
 */
export default function ClubLocationInheritanceButton({
  profileId,
  onSelect,
}: {
  profileId: string;
  onSelect: (club: Club) => void;
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
  const available = clubs.filter((club) => Boolean(club.locationPlaceId));

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline-dark"
        disabled={!available.length}
        title={
          available.length
            ? "Use the location of a club this profile belongs to"
            : "None of this profile's clubs has a location yet"
        }
        onClick={() => {
          if (available.length === 1) choose(available[0]);
          else if (available.length > 1) setShow(true);
        }}
      >
        Inherit club location
      </Button>
      <Modal show={show} onHide={() => setShow(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Choose a club location</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="text-muted small">
            This club profile belongs to more than one club. Choose the club
            whose location it should use.
          </p>
          <div className="d-grid gap-2">
            {available.map((club) => (
              <Button
                key={String(club.id)}
                variant="outline-dark"
                className="text-start"
                onClick={() => choose(club)}
              >
                <strong>{club.name}</strong>
                <span className="d-block small text-muted">
                  {club.location}
                </span>
              </Button>
            ))}
          </div>
        </Modal.Body>
      </Modal>
    </>
  );
}
