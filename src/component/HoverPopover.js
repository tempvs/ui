import React, { Component } from 'react';

import { Popover } from 'react-bootstrap';

import { FormattedMessage } from "react-intl";

class HoverPopover extends Component {
  render() {
    return (
      <Popover className="popover" {...this.props} style={{padding: '7px', ...this.props.style}}>
        <FormattedMessage id={this.props.text} defaultMessage={this.props.default}/>
      </Popover>
    );
  }
}

export default HoverPopover;
