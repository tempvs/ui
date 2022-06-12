import React, { Component } from 'react';
import { Container, Row, Col } from 'react-bootstrap'

class HomePage extends Component {
    render() {    
      return (
        <Container fluid>
          <Row>
            <Col sm={4}>
            </Col>
            <Col sm={4}>
              Hello
            </Col>
            <Col sm={4}>
            </Col>
          </Row>
        </Container>
      );
    }
}

export default HomePage;
