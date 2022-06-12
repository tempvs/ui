import React, { Component } from "react";

import { Container, Row, Col } from 'react-bootstrap'

import { Link } from '@reach/router';

import Cookies from 'js-cookie';

import ProfileButton from '../profile/ProfileButton';
import LibraryButton from '../library/LibraryButton';
import LoginRegisterButton from '../auth/LoginRegisterButton';
import LogOutButton from '../auth/LogOutButton';

import "./Header.css";

class Header extends Component {
  constructor() {
    super();
    this.state = {
      loggedIn: Cookies.get('TEMPVS_LOGGED_IN')
    };
    this.logIn = this.logIn.bind(this);
    this.logOut = this.logOut.bind(this);
  }

  logIn() {
    this.setState({loggedIn: true});
  }

  logOut() {
    this.setState({loggedIn: false})
  }

  render() {
    return (
      <div className="Header">
        <Container>
          <Row className="show-grid">
            <Col sm={3}>
              {this.state.loggedIn &&
                <Link to="/profile">
                  <ProfileButton />
                </Link>
              }
            </Col>
            <Col sm={6}>
              <Link to="/library">
                <LibraryButton />
              </Link>
            </Col>
            <Col sm={2}>
            </Col>
            <Col sm={1}>
              {this.state.loggedIn ? <LogOutButton logOut={this.logOut}/> : <LoginRegisterButton logIn={this.logIn}/>}
            </Col>
          </Row>
        </Container>
      </div>
    );
  }
}

export default Header;
