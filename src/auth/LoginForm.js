import React, { Component } from 'react';

import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form'

import { FormattedMessage } from "react-intl";

import { doFetch } from "../util/Fetcher.js";

const initialState = {messageShown: false, messageText: ''};

class LoginForm extends Component {
  constructor() {
    super();
    this.state = initialState;
  }

  handleSubmit = (event) => {
    event.preventDefault();
    this.setState(initialState);

    const actions = {
      401: () => this.showMessage("login.failed"),
      200: () => this.props.logIn()
    };

    doFetch("/api/user/login", "POST", event, actions);
  };

  showMessage = (text) => {
    this.setState({messageShown: true, messageText: text});
  };

  render() {
    return (
      <Form onSubmit={this.handleSubmit}>
        <Form.Group controlId="email" className="row">
          <Form.Label className="col-sm-4"><FormattedMessage id="email.label" defaultMessage="Email"/> *</Form.Label>
          <Form.Control className="col-sm-8" name="email" type="email" required/>
        </Form.Group>
        <Form.Group controlId="password" className="row">
          <Form.Label className="col-sm-4"><FormattedMessage id="password.label" defaultMessage="Password"/> *</Form.Label>
          <Form.Control className="col-sm-8" name="password" type="password" required/>
        </Form.Group>
        {this.state.messageShown &&
          <div>
            <FormattedMessage id={this.state.messageText} defaultMessage="Wrong login or password"/>
          </div>
        }
        <Button variant="secondary" type="submit">
          <FormattedMessage id="login.button" defaultMessage="Log in"/>
        </Button>
      </Form>
    );
  }
}

export default LoginForm;
