import React, { useEffect, useState } from "react";
import { Col, Container, Row } from "react-bootstrap";
import { Navigate } from "react-router-dom";

import AuthPanel from "./auth/AuthPanel";
import { fetchCurrentUserInfo, fetchUserProfileByUserId } from "./profile/profileApi";
import WallPage from "./wall/WallPage";
import Spinner from "./component/Spinner";
import HomeExplorePanel from "./home/HomeExplorePanel";

export default function HomePage() {
  const [userId, setUserId] = useState<string | null>();
  const [profileMissing, setProfileMissing] = useState(false);
  const [profileChecked, setProfileChecked] = useState(false);
  useEffect(() => {
    let active = true;
    fetchCurrentUserInfo((info) => {
      if (!active) return;
      setUserId(info.currentUserId);
      if (!info.currentUserId) {
        setProfileChecked(true);
        return;
      }
      fetchUserProfileByUserId(info.currentUserId, {
        onSuccess: () => {
          if (!active) return;
          setProfileMissing(false);
          setProfileChecked(true);
        },
        onMissing: () => {
          if (!active) return;
          setProfileMissing(true);
          setProfileChecked(true);
        },
        // A transient read failure must not be mistaken for a new account.
        onError: () => {
          if (!active) return;
          setProfileMissing(false);
          setProfileChecked(true);
        },
      });
    });
    return () => { active = false; };
  }, []);

  if (userId === undefined)
    return (
      <div className="home-message-panel">
        <Spinner size="sm" />
      </div>
    );
  if (userId && !profileChecked)
    return (
      <div className="home-message-panel">
        <Spinner size="sm" />
      </div>
    );
  if (userId && profileMissing) return <Navigate replace to="/profile" />;
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
      <HomeExplorePanel />
    </Container>
  );
}
