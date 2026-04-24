import React, { useState } from 'react';
import { FaSignOutAlt } from 'react-icons/fa';
import { Button, Modal } from 'react-bootstrap';
import { FormattedMessage } from 'react-intl';

import { doFetch } from '../util/Fetcher';
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

      <Modal show={showModal} onHide={handleClose} centered dialogClassName="auth-modal-dialog auth-logout-dialog" contentClassName="auth-modal-content">
        <Modal.Header closeButton className="auth-modal-header">
          <div className="auth-modal-title-block">
            <span className="auth-modal-kicker">
              <FormattedMessage id="logout.popover" defaultMessage="Log out" />
            </span>
            <Modal.Title className="auth-modal-title">
              <FormattedMessage id="auth.logout.title" defaultMessage="Leave this session?" />
            </Modal.Title>
          </div>
        </Modal.Header>
        <Modal.Body className="auth-modal-body">
          <div className="auth-logout-copy">
            <FormattedMessage id="logout.confirmation" defaultMessage="Are you sure you want to log out?" />
          </div>
          <div className="auth-logout-actions">
            <Button variant="light" type="button" className="auth-secondary-button" onClick={handleClose}>
              <FormattedMessage id="no" defaultMessage="No" />
            </Button>
            <Button variant="secondary" type="button" className="auth-submit-button" onClick={handleLogOut}>
              <FormattedMessage id="yes" defaultMessage="Yes" />
            </Button>
          </div>
        </Modal.Body>
      </Modal>
    </>
  );
}
