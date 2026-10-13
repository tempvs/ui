import React, { useEffect, useState } from "react";
import { Col, Container, Row } from "react-bootstrap";

import AuthPanel from "./auth/AuthPanel";
import { fetchCurrentUserInfo } from "./profile/profileApi";
import WallPage from "./wall/WallPage";
import Spinner from "./component/Spinner";

export default function HomePage() {
  const [userId, setUserId] = useState<string | null>();
  useEffect(
    () => fetchCurrentUserInfo((info) => setUserId(info.currentUserId)),
    [],
  );

  if (userId === undefined)
    return (
      <div className="home-message-panel">
        <Spinner size="sm" />
      </div>
    );
  if (userId) return <WallPage userId={userId} />;
  return (
    <Container fluid className="home-shell px-4 px-xl-5">
      <Row className="home-landing-row">
        <Col lg={8} className="home-landing-copy-column">
          <section className="home-message-panel home-welcome-panel">
            <h1 className="home-welcome-title">Welcome to Tempvs!</h1>
            <p className="home-message">
              Bring history to life — together. Create your reenactor profiles,
              document your clothing, armor, weapons, and equipment, and support
              each item with archaeological, visual, and written sources.
              Explore other reenactors, compare interpretations and organize
              events with the community.
            </p>
          </section>
        </Col>
        <Col lg={4} className="home-auth-column">
          <section className="home-auth-panel auth-modal-content">
            <div className="auth-modal-title-block home-auth-title-block">
              <span className="auth-modal-kicker">Log in</span>
              <h2 className="auth-modal-title">Welcome to Tempvs</h2>
            </div>
            <AuthPanel />
          </section>
        </Col>
      </Row>
    </Container>
  );
}
