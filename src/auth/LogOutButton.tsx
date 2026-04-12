import React, { useState } from 'react';
import { FaSignOutAlt } from 'react-icons/fa';
import { Button, Modal } from 'react-bootstrap';
import { FormattedMessage } from 'react-intl';

import { doFetch } from '../util/Fetcher.js';
import HeaderIconPopover from '../component/HeaderIconPopover';

type LogOutButtonProps = {
  logOut: () => void;
  avatarUrl?: string | null;
  avatarText?: string | null;
};

const SignOutIcon = FaSignOutAlt as React.ComponentType;

export default function LogOutButton({ logOut, avatarUrl, avatarText }: LogOutButtonProps) {
  const [showModal, setShowModal] = useState(false);

  const handleClose = () => setShowModal(false);
  const handleShow = () => setShowModal(true);

  const handleLogOut = () => {
    const actions = {
      200: () => {
        handleClose();
        logOut();
      },
    };

    doFetch('/api/user/logout', 'POST', null, actions);
  };

  const avatar = avatarUrl
    ? (
      <span className="auth-avatar-badge">
        <img className="auth-avatar-image" src={avatarUrl} alt="" referrerPolicy="no-referrer" />
      </span>
    )
    : avatarText
      ? <span className="auth-avatar-badge auth-avatar-text">{avatarText}</span>
      : null;

  return (
    <>
      <HeaderIconPopover text="logout.popover" defaultMessage="Log out">
        <Button className="header-icon-button auth-control-button" variant="default" onClick={handleShow}>
          {avatar}
          <SignOutIcon />
        </Button>
      </HeaderIconPopover>

      <Modal show={showModal} onHide={handleClose}>
        <Modal.Body>
          <div className="text-center">
            <FormattedMessage id="logout.confirmation" defaultMessage="Are you sure you want to log out?" />
          </div>
          <div>
            <Button variant="secondary" type="submit" className="float-sm-left" onClick={handleLogOut}>
              <FormattedMessage id="yes" defaultMessage="Yes" />
            </Button>
            <Button variant="secondary" type="submit" className="float-sm-right" onClick={handleClose}>
              <FormattedMessage id="no" defaultMessage="No" />
            </Button>
          </div>
        </Modal.Body>
      </Modal>
    </>
  );
}
