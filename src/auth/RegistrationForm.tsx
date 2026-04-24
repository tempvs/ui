import React, { Component } from 'react';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import { FormattedMessage } from 'react-intl';

import { doFetch } from '../util/Fetcher';

const initialState = { messageShown: false, messageText: '', successShown: false };

type RegistrationFormState = typeof initialState;

class RegistrationForm extends Component<Record<string, never>, RegistrationFormState> {
  constructor(props: Record<string, never>) {
    super(props);
    this.state = initialState;
  }

  handleSubmit: React.FormEventHandler<HTMLFormElement> = event => {
    event.preventDefault();
    this.setState(initialState);

    const actions = {
      409: () => this.showMessage('user.alreadyRegistered.message'),
      200: () => this.showSuccess(),
    };

    doFetch('/api/user/register', 'POST', event, actions);
  };

  showMessage = (text: string) => {
    this.setState({ messageShown: true, messageText: text, successShown: false });
  };

  showSuccess = () => {
    this.setState({ messageShown: false, messageText: '', successShown: true });
  };

  render() {
    return (
      <Form onSubmit={this.handleSubmit} className="auth-form">
        <div className="auth-form-copy">
          <FormattedMessage id="auth.register.subtitle" defaultMessage="Request a verification link for any email address you want to use." />
        </div>
        <Form.Group controlId="email" className="auth-form-group">
          <Form.Label className="auth-form-label">
            <FormattedMessage id="email.label" defaultMessage="Email" />
          </Form.Label>
          <Form.Control className="auth-form-input" name="email" type="email" required />
        </Form.Group>
        {this.state.messageShown && (
          <div className="tempvs-plain-message auth-message auth-message-error">
            <FormattedMessage id={this.state.messageText} defaultMessage="User with this email has already been registered" />
          </div>
        )}
        {this.state.successShown && (
          <div className="tempvs-plain-message auth-message auth-message-success">
            <FormattedMessage id="registration.requested.message" defaultMessage="Check your email to finish registration." />
          </div>
        )}
        <Button variant="secondary" type="submit" className="auth-submit-button">
          <FormattedMessage id="request.registration.button" defaultMessage="Request registration" />
        </Button>
      </Form>
    );
  }
}

export default RegistrationForm;
