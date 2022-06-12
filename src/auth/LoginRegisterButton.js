import React, { Component } from 'react';
import { FaSignInAlt } from 'react-icons/fa';
import { Button, Modal, Tab, Tabs, OverlayTrigger }  from 'react-bootstrap';
import { FormattedMessage } from "react-intl";
import LoginForm from './LoginForm';
import RegistrationForm from './RegistrationForm';
import HoverPopover from '../component/HoverPopover';

class LoginRegisterButton extends Component {
  constructor() {
    super();
    this.state = {
      show: false
    };

    this.handleShow = this.handleShow.bind(this);
    this.handleClose = this.handleClose.bind(this);
    this.logIn = this.logIn.bind(this);
  }

  handleShow() {
    this.setState({show: true});
  }

  handleClose() {
    this.setState({show: false});
  }

  logIn() {
    this.handleClose();
    this.props.logIn();
  }

  render() {
    const popover = (<HoverPopover text="login.popover" default="Log in" />);

    return (
      <>
        <OverlayTrigger trigger="hover" placement="bottom" overlay={popover}> 
          <Button className="float-sm-right" variant="default" onClick={this.handleShow}>
            <FaSignInAlt/>
          </Button>
        </OverlayTrigger>

        <Modal show={this.state.show} onHide={this.handleClose}>
          <Modal.Body>
            <Tabs className="row">
              <Tab eventKey="login" title={<FormattedMessage id="login.tab" defaultMessage="Log in"/>}>
                <LoginForm logIn={this.logIn} />
              </Tab>
              <Tab eventKey="register" title={<FormattedMessage id="register.tab" defaultMessage="Register"/>}>
                <RegistrationForm />
              </Tab>
            </Tabs>
          </Modal.Body>
        </Modal>
      </>
    );
  }
}

export default LoginRegisterButton;
