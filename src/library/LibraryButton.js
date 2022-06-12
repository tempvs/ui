import React, { Component } from 'react';
import { FaBook } from 'react-icons/fa';
import { Button, OverlayTrigger } from 'react-bootstrap';
import HoverPopover from '../component/HoverPopover';

class LibraryButton extends Component {
  render() {
    const popover = (
      <HoverPopover text="library.popover" default="Library" />
    );
    return (
      <OverlayTrigger trigger="hover" placement="bottom" overlay={popover}> 
        <Button className="float-sm-right" variant="default">
          <FaBook/>
        </Button>
      </OverlayTrigger>
    );
  }
}

export default LibraryButton;
