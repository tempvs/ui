import React, { Component } from 'react';
import { FaUser } from 'react-icons/fa';
import { Button, OverlayTrigger } from 'react-bootstrap';
import HoverPopover from '../component/HoverPopover';

class ProfileButton extends Component {
  render() {
    const popover = (<HoverPopover text="profile.popover" default="Profile" />);
    return (
      <>
        <OverlayTrigger trigger="hover" placement="bottom" overlay={popover}> 
          <Button className="float-sm-right" variant="default">
            <FaUser/>
          </Button>
        </OverlayTrigger>
      </>
    );
  }
}

export default ProfileButton;
