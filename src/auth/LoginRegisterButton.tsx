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

  return (
    <>
      <HeaderIconPopover text="login.popover" defaultMessage="Log in">
        <Button className="header-icon-button" variant="default" onClick={() => setShow(true)}>
          <SignInIcon />
        </Button>
      </HeaderIconPopover>

      <Modal show={show} onHide={() => setShow(false)}>
        <Modal.Body>
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
