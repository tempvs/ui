import React, { Component } from "react";

import { FormattedMessage } from "react-intl";

import Container from "react-bootstrap/Container";

class PeriodTile extends Component {
  render() {
    const period = this.props.period;

    return (
      <Container
        className="PeriodTile btn btn-light"
        style={{ padding: '1rem 1.1rem', borderRadius: '1rem', minHeight: '100%' }}
      >
        <div className="d-flex flex-column h-100">
          <img
            src={ require(`./images/thumbnails/${period}.jpg`) }
            alt={period}
            style={{
              width: '100%',
              height: '11rem',
              borderRadius: '0.9rem',
              objectFit: 'cover',
              marginBottom: '0.9rem',
            }}
          />
          <div className="text-start">
            <h2 className="mb-2 fs-4"><FormattedMessage id={`period.${period}.heading`} defaultMessage={period} /></h2>
            <div className="small text-muted">
              <FormattedMessage id={`period.${period}.shortDescription`} defaultMessage={`${period} short description`} />
            </div>
          </div>
        </div>
      </Container>
    );
  }
}

export default PeriodTile;
