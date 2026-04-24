import React, { useState } from 'react';
import { FaGoogle, FaSignInAlt, FaUserPlus } from 'react-icons/fa';
import { Button, Modal, Tab, Tabs } from 'react-bootstrap';
import { FormattedMessage } from 'react-intl';

import HeaderIconPopover from '../component/HeaderIconPopover';
import LoginForm from './LoginForm';
import RegistrationForm from './RegistrationForm';

type IconProps = {
  className?: string;
};

const GoogleIcon = FaGoogle as React.ComponentType<IconProps>;
const SignInIcon = FaSignInAlt as React.ComponentType;
const RegisterIcon = FaUserPlus as React.ComponentType<IconProps>;

type LoginRegisterButtonProps = {
  logIn: () => void;
};

export default function LoginRegisterButton({ logIn }: LoginRegisterButtonProps) {
  const [show, setShow] = useState(false);
  const close = () => setShow(false);
  const handleLogIn = () => {
    close();
    logIn();
  };

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
          <Tabs defaultActiveKey="login" className="auth-tabs">
            <Tab
              eventKey="login"
              title={(
                <span className="auth-tab-label">
                  <SignInIcon />
                  <FormattedMessage id="login.tab" defaultMessage="Log in" />
                </span>
              )}
            >
              <LoginForm logIn={handleLogIn} />
            </Tab>
            <Tab
              eventKey="register"
              title={(
                <span className="auth-tab-label">
                  <RegisterIcon />
                  <FormattedMessage id="register.tab" defaultMessage="Register" />
                </span>
              )}
            >
              <RegistrationForm />
            </Tab>
          </Tabs>
          <div className="auth-divider">
            <span>
              <FormattedMessage id="auth.divider" defaultMessage="or continue with" />
            </span>
          </div>
          <div className="d-grid auth-oauth-grid">
            <Button
              as="a"
              href="/api/user/oauth2/authorization/google"
              variant="light"
              className="auth-oauth-button"
            >
              <GoogleIcon className="me-2" />
              <FormattedMessage id="login.google.button" defaultMessage="Authenticate with Gmail" />
            </Button>
          </div>
        </Modal.Body>
      </Modal>
    </>
  );
}
