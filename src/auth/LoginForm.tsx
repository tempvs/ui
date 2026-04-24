import React, { Component } from 'react';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import { FormattedMessage } from 'react-intl';

import { doFetch } from '../util/Fetcher';

const initialState = { messageShown: false, messageText: '' };

type LoginFormProps = {
  logIn: () => void;
};

type LoginFormState = typeof initialState;

class LoginForm extends Component<LoginFormProps, LoginFormState> {
  constructor(props: LoginFormProps) {
    super(props);
    this.state = initialState;
  }

  handleSubmit: React.FormEventHandler<HTMLFormElement> = event => {
    event.preventDefault();
    this.setState(initialState);

    const actions = {
      401: () => this.showMessage('login.failed'),
      200: () => this.props.logIn(),
    };

    doFetch('/api/user/login', 'POST', event, actions);
  };

  showMessage = (text: string) => {
    this.setState({ messageShown: true, messageText: text });
  };

  render() {
    return (
      <Form onSubmit={this.handleSubmit} className="auth-form">
        <div className="auth-form-copy">
          <FormattedMessage id="auth.login.subtitle" defaultMessage="Use your email and password to continue." />
        </div>
        <Form.Group controlId="email" className="auth-form-group">
          <Form.Label className="auth-form-label">
            <FormattedMessage id="email.label" defaultMessage="Email" />
          </Form.Label>
          <Form.Control className="auth-form-input" name="email" type="email" required />
        </Form.Group>
        <Form.Group controlId="password" className="auth-form-group">
          <Form.Label className="auth-form-label">
            <FormattedMessage id="password.label" defaultMessage="Password" />
          </Form.Label>
          <Form.Control className="auth-form-input" name="password" type="password" required />
        </Form.Group>
        {this.state.messageShown && (
          <div className="tempvs-plain-message auth-message auth-message-error">
            <FormattedMessage id={this.state.messageText} defaultMessage="Wrong login or password" />
          </div>
        )}
        <Button variant="secondary" type="submit" className="auth-submit-button">
          <FormattedMessage id="login.button" defaultMessage="Log in" />
        </Button>
      </Form>
    );
  }
}

export default LoginForm;
