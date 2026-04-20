import React, { Component } from 'react';
import { Button, Col, Container, Form, Row } from 'react-bootstrap';
import { FormattedMessage } from 'react-intl';
import { NavigateFunction, useNavigate, useParams } from 'react-router-dom';

import { doFetch } from '../util/Fetcher';

const initialState = { messageShown: false, messageText: '' };

type CompleteRegistrationPageProps = {
  verificationId?: string;
  navigate: NavigateFunction;
};

type CompleteRegistrationPageState = typeof initialState;

class CompleteRegistrationPage extends Component<CompleteRegistrationPageProps, CompleteRegistrationPageState> {
  constructor(props: CompleteRegistrationPageProps) {
    super(props);
    this.state = initialState;
  }

  handleSubmit: React.FormEventHandler<HTMLFormElement> = event => {
    event.preventDefault();
    this.setState(initialState);

    const actions = {
      200: () => {
        this.props.navigate('/profile');
        window.location.reload();
      },
      400: () => this.showMessage('registration.complete.invalid'),
      404: () => this.showMessage('registration.complete.expired'),
      409: () => this.showMessage('user.alreadyRegistered.message'),
    };

    doFetch(`/api/user/verify/${this.props.verificationId}`, 'POST', event, actions);
  };

  showMessage = (text: string) => {
    this.setState({ messageShown: true, messageText: text });
  };

  render() {
    if (!this.props.verificationId) {
      return (
        <Container>
          <Row>
            <Col sm={{ span: 6, offset: 3 }}>
              <FormattedMessage id="registration.complete.expired" defaultMessage="This registration link is invalid or expired." />
            </Col>
          </Row>
        </Container>
      );
    }

    return (
      <Container>
        <Row>
          <Col sm={{ span: 6, offset: 3 }}>
            <h1>
              <FormattedMessage id="registration.complete.title" defaultMessage="Finish registration" />
            </h1>
            <Form onSubmit={this.handleSubmit}>
              <Form.Group controlId="password" className="row">
                <Form.Label className="col-sm-4">
                  <FormattedMessage id="password.label" defaultMessage="Password" /> *
                </Form.Label>
                <Form.Control className="col-sm-8" name="password" type="password" required />
              </Form.Group>
              {this.state.messageShown && (
                <div>
                  <FormattedMessage id={this.state.messageText} defaultMessage="Unable to finish registration." />
                </div>
              )}
              <Button variant="secondary" type="submit">
                <FormattedMessage id="registration.complete.button" defaultMessage="Create account" />
              </Button>
            </Form>
          </Col>
        </Row>
      </Container>
    );
  }
}

export default function CompleteRegistrationPageWithParams() {
  const { verificationId } = useParams();
  const navigate = useNavigate();
  return <CompleteRegistrationPage verificationId={verificationId} navigate={navigate} />;
}
