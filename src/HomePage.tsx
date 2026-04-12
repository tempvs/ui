import React from 'react';
import { Col, Container, Row } from 'react-bootstrap';

export default function HomePage() {
  return (
    <Container fluid>
      <Row>
        <Col sm={4} />
        <Col sm={4}>
          Hello
        </Col>
        <Col sm={4} />
      </Row>
    </Container>
  );
}
