import React, { Component } from "react";

import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";

import { FormattedMessage } from "react-intl";

import { doFetch } from "../util/Fetcher.js";

const initialState = {messageShown: false, messageText: ''};

class RegistrationForm extends Component {
  constructor() {
    super();
    this.state = initialState;
  }

  handleSubmit = (event) => {
    event.preventDefault();
    this.setState(initialState);

    const actions = {
      409: () => this.showMessage("user.alreadyRegistered.message")
    };

    doFetch("/api/user/register", "POST", event, actions);
  }

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
        {this.state.messageShown &&
          <div>
            <FormattedMessage id={this.state.messageText} defaultMessage="User with this email has already been registered"/>
          </div>
        }
        <Button variant="secondary" type="submit">
          <FormattedMessage id="request.registration.button" defaultMessage="Request registration"/>
        </Button>
      </Form>
    );
  }
}

export default RegistrationForm;
