import React, { useState } from 'react';
import { FaSignInAlt } from 'react-icons/fa';
import { Button, Modal } from 'react-bootstrap';
import { FormattedMessage } from 'react-intl';

import HeaderIconPopover from '../component/HeaderIconPopover';

const SignInIcon = FaSignInAlt as React.ComponentType;

/** Starts Cognito's authorization-code flow without exposing credentials to the UI. */
export default function LoginRegisterButton() {
  const [show, setShow] = useState(false);

  return <>
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
      <Modal.Body className="auth-modal-body">
        <p className="auth-form-copy">Continue to the secure sign-in page to use email/password or Google.</p>
        <div className="d-grid gap-2 auth-oauth-grid">
          <Button as="a" href="/auth/login" className="auth-submit-button">Sign in</Button>
          <Button as="a" href="/auth/login?returnTo=/profile" variant="light" className="auth-oauth-button">Create account</Button>
        </div>
      </Modal.Body>
    </Modal>
  </>;
}
