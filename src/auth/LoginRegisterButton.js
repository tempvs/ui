import React, { Component } from 'react';
import { FaGoogle, FaSignInAlt } from 'react-icons/fa';
import { Button, Modal, OverlayTrigger }  from 'react-bootstrap';
import { FormattedMessage } from "react-intl";
import HoverPopover from '../component/HoverPopover';

class LoginRegisterButton extends Component {
  constructor() {
    super();
    this.state = {
      show: false
    };

    this.handleShow = this.handleShow.bind(this);
    this.handleClose = this.handleClose.bind(this);
  }

  handleShow() {
    this.setState({show: true});
  }

  handleClose() {
    this.setState({show: false});
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
            <div className="d-grid gap-2">
              <Button
                as="a"
                href="/api/user/oauth2/authorization/google"
                variant="outline-danger"
              >
                <FaGoogle className="me-2"/>
                <FormattedMessage id="login.google.button" defaultMessage="Authenticate with Gmail"/>
              </Button>
            </div>
          </Modal.Body>
        </Modal>
      </>
    );
  }
}

export default LoginRegisterButton;
