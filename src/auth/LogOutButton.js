import React, { Component } from 'react';
import { FaSignOutAlt } from 'react-icons/fa';
import { Button, Modal, OverlayTrigger } from 'react-bootstrap';
import { FormattedMessage } from "react-intl";
import { doFetch } from "../util/Fetcher.js";
import HoverPopover from '../component/HoverPopover';

class LogOutButton extends Component {
  constructor() {
    super();
    this.state = {
      showModal: false
    };

    this.handleShow = this.handleShow.bind(this);
    this.handleClose = this.handleClose.bind(this);
    this.logOut = this.logOut.bind(this);
  }

  handleShow() {
    this.setState({showModal: true});
  }

  handleClose() {
    this.setState({showModal: false});
  }

  logOut() {
    const actions = {
      200: () => {
        this.handleClose();
        this.props.logOut();
      }
    };

    doFetch("/api/user/logout", "POST", null, actions);
  }

  render() {
    const popover = (<HoverPopover text="logout.popover" default="Log out" />);
    const avatar = this.props.avatarUrl
      ? (
        <span className="auth-avatar-badge">
          <img className="auth-avatar-image" src={this.props.avatarUrl} alt="" referrerPolicy="no-referrer" />
        </span>
      )
      : this.props.avatarText
        ? <span className="auth-avatar-badge auth-avatar-text">{this.props.avatarText}</span>
      : null;

    return (
      <>
        <OverlayTrigger trigger="hover" placement="bottom" overlay={popover}> 
          <Button className="float-sm-right auth-control-button" variant="default" onClick={this.handleShow}>
            {avatar}
            <FaSignOutAlt/>
          </Button>
        </OverlayTrigger>

        <Modal show={this.state.showModal} onHide={this.handleClose}>
          <Modal.Body>
            <div className="text-center">
              <FormattedMessage id="logout.confirmation" defaultMessage="Are you sure you want to log out?"/>
            </div>
            <div>
              <Button variant="secondary" type="submit" className="float-sm-left" onClick={this.logOut}>
                <FormattedMessage id="yes" defaultMessage="Yes"/>
              </Button>
              <Button variant="secondary" type="submit" className="float-sm-right" onClick={this.handleClose}>
                <FormattedMessage id="no" defaultMessage="No"/>
              </Button>
            </div>
          </Modal.Body>
        </Modal>
      </>
    );
  }
}

export default LogOutButton;
