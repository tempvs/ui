import React, { useEffect, useState } from 'react';
import { Col, Container, Row } from 'react-bootstrap';
import { FaBook, FaSignInAlt } from 'react-icons/fa';
import { Spinner } from 'react-bootstrap';
import { fetchCurrentUserInfo } from './profile/profileApi';
import WallPage from './wall/WallPage';

type IconProps = {
  className?: string;
};

const BookIcon = FaBook as React.ComponentType<IconProps>;
const SignInIcon = FaSignInAlt as React.ComponentType<IconProps>;

export default function HomePage() {
  const [userId, setUserId] = useState<string | null>();
  useEffect(() => fetchCurrentUserInfo(info => setUserId(info.currentUserId)), []);

  if (userId === undefined) return <div className="home-message-panel"><Spinner animation="border" size="sm" /></div>;
  if (userId) return <WallPage userId={userId} />;
  return (
    <Container fluid className="home-shell px-4 px-xl-5">
      <Row className="justify-content-center">
        <Col xl={8} lg={9} md={10}>
          <div className="home-message-panel">
            <p className="home-message">
              Welcome to Tempvs! To sign in with Google, press{' '}
              <span className="home-inline-icon"><SignInIcon /></span>. You can
              create your reenactment profiles and associate them with your user account. To access the library, press{' '}
              <span className="home-inline-icon"><BookIcon /></span>.
            </p>
          </div>
        </Col>
      </Row>
    </Container>
  );
}
