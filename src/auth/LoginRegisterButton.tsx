import React, { useState } from 'react';
import { FaGoogle, FaSignInAlt } from 'react-icons/fa';
import { Button, Modal } from 'react-bootstrap';
import { FormattedMessage } from 'react-intl';

import HeaderIconPopover from '../component/HeaderIconPopover';

type IconProps = {
  className?: string;
};

const GoogleIcon = FaGoogle as React.ComponentType<IconProps>;
const SignInIcon = FaSignInAlt as React.ComponentType;
export default function LoginRegisterButton() {
  const [show, setShow] = useState(false);
  const close = () => setShow(false);

  return (
    <>
      <HeaderIconPopover text="login.popover" defaultMessage="Log in">
        <Button className="header-icon-button" variant="default" onClick={() => setShow(true)}>
          <SignInIcon />
        </Button>
      </HeaderIconPopover>

      <Modal show={show} onHide={close} centered dialogClassName="auth-modal-dialog" contentClassName="auth-modal-content">
        <Modal.Header closeButton className="auth-modal-header">
          <div className="auth-modal-title-block">
            <span className="auth-modal-kicker">
              <FormattedMessage id="login.popover" defaultMessage="Log in" />
            </span>
            <Modal.Title className="auth-modal-title">
              <FormattedMessage id="auth.modal.title" defaultMessage="Welcome back" />
            </Modal.Title>
          </div>
        </Modal.Header>
        <Modal.Body className="auth-modal-body">
          <div className="d-grid auth-oauth-grid">
            <Button
              as="a"
              href="/api/user/oauth2/authorization/google"
              variant="light"
              className="auth-oauth-button"
            >
              <GoogleIcon className="me-2" />
              <FormattedMessage id="login.google.button" defaultMessage="Continue with Google" />
            </Button>
          </div>
        </Modal.Body>
      </Modal>
    </>
  );
}
