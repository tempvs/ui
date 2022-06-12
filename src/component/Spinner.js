import React, { Component } from 'react';

import { Image }  from 'react-bootstrap';

import { FormattedMessage } from "react-intl";

class Spinner extends Component {
  render() {
    const src = `${window.location.origin}/spinner.gif`;
    return (
      <FormattedMessage id="loading" defaultMessage="Loading">
        {(alt) => ( <Image alt={alt} src={src} />)}
      </FormattedMessage>
    );
  }
}

export default Spinner;
