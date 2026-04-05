import React, { Component } from 'react';

import { Popover } from 'react-bootstrap';

import { FormattedMessage } from "react-intl";

class HoverPopover extends Component {
  render() {
    const { text, default: defaultMessage, style, ...rest } = this.props;

    return (
      <Popover className="popover" {...rest} style={{padding: '7px', ...style}}>
        {text ? (
          <FormattedMessage id={text} defaultMessage={defaultMessage}/>
        ) : (
          defaultMessage
        )}
      </Popover>
    );
  }
}

export default HoverPopover;
