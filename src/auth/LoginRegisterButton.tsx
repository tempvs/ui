import React, { useState } from 'react';
import { FaGoogle, FaSignInAlt } from 'react-icons/fa';
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

      <Modal show={show} onHide={close}>
        <Modal.Body>
          <Tabs defaultActiveKey="login" className="mb-3">
            <Tab eventKey="login" title={<FormattedMessage id="login.tab" defaultMessage="Log in" />}>
              <LoginForm logIn={handleLogIn} />
            </Tab>
            <Tab eventKey="register" title={<FormattedMessage id="register.tab" defaultMessage="Register" />}>
              <RegistrationForm />
            </Tab>
          </Tabs>
          <div className="d-grid gap-2">
            <Button
              as="a"
              href="/api/user/oauth2/authorization/google"
              variant="outline-danger"
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
