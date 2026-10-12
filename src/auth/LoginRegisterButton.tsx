import React, { useState } from "react";
import { Button, Modal } from "react-bootstrap";
import { FaSignInAlt } from "react-icons/fa";
import { FormattedMessage } from "react-intl";

import HeaderIconPopover from "../component/HeaderIconPopover";
import AuthPanel from "./AuthPanel";

const SignInIcon = FaSignInAlt as React.ComponentType;

export default function LoginRegisterButton() {
  const [show, setShow] = useState(false);

  return (
    <>
      <HeaderIconPopover text="login.popover" defaultMessage="Log in">
        <Button className="header-icon-button" variant="default" onClick={() => setShow(true)}>
          <SignInIcon />
        </Button>
      </HeaderIconPopover>

      <Modal show={show} onHide={() => setShow(false)} centered dialogClassName="auth-modal-dialog" contentClassName="auth-modal-content">
        <Modal.Header closeButton className="auth-modal-header">
          <div className="auth-modal-title-block">
            <span className="auth-modal-kicker"><FormattedMessage id="login.popover" defaultMessage="Log in" /></span>
            <Modal.Title className="auth-modal-title">Welcome to Tempvs</Modal.Title>
          </div>
        </Modal.Header>
        <Modal.Body className="auth-modal-body"><AuthPanel /></Modal.Body>
      </Modal>
    </>
  );
}
