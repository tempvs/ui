import React from 'react';
import { Col, Container, Row } from 'react-bootstrap';
import { FaBook, FaSignInAlt } from 'react-icons/fa';

type IconProps = {
  className?: string;
};

const BookIcon = FaBook as React.ComponentType<IconProps>;
const SignInIcon = FaSignInAlt as React.ComponentType<IconProps>;

export default function HomePage() {
  return (
    <Container fluid className="home-shell px-4 px-xl-5">
      <Row className="justify-content-center">
        <Col xl={8} lg={9} md={10}>
          <div className="home-message-panel">
            <p className="home-message">
              To see the library, press <span className="home-inline-icon"><BookIcon /></span>. To login/register, press the{' '}
              <span className="home-inline-icon"><SignInIcon /></span>.
            </p>
          </div>
        </Col>
      </Row>
    </Container>
  );
}
