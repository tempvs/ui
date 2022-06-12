import React, { Component } from "react";

import { FormattedMessage } from "react-intl";

import Container from "react-bootstrap/Container";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";

class PeriodTile extends Component {
  render() {
    const period = this.props.period;

    return (
      <Container className="PeriodTile btn btn-light">
        <Row className="show-grid">
          <Col sm={2}>
            <img src={ require(`./images/thumbnails/${period}.jpg`) } alt={period} />
          </Col>
          <Col sm={10}>
             <h2><FormattedMessage id={`period.${period}.heading`} defaultMessage={period} /></h2>
             <FormattedMessage id={`period.${period}.shortDescription`} defaultMessage={`${period} short description`} />
          </Col>
        </Row>
      </Container>
    );
  }
}

export default PeriodTile;
