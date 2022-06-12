import React, { Component } from 'react';

import { FormattedMessage } from "react-intl";

import { Link } from "@reach/router";

import PeriodTile from './PeriodTile';

class LibraryPage extends Component {
  render() {
    const periods = ["ancient", "antiquity", "early_middle_ages", "high_middle_ages", "renaissance",
        "modern", "wwi", "wwii", "contemporary", "other"];

    return (
      <>
        <h1><FormattedMessage id="periods.title" defaultMessage="Historical periods"/></h1>
        {periods.map(
          period => (
            <Link to={"/" + period} key={period}>
              <PeriodTile period={period}/>
            </Link>
          )
        )}
      </>
    );
  }
}

export default LibraryPage;
