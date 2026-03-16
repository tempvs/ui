import React, { Component } from "react";

import { Container, Row, Col } from 'react-bootstrap'

import { Link } from 'react-router-dom';

import Cookies from 'js-cookie';

import ProfileButton from '../profile/ProfileButton';
import LibraryButton from '../library/LibraryButton';
import LoginRegisterButton from '../auth/LoginRegisterButton';
import LogOutButton from '../auth/LogOutButton';
import { doFetch } from '../util/Fetcher';

import "./Header.css";

class Header extends Component {
  constructor() {
    super();
    const loggedIn = Cookies.get('TEMPVS_LOGGED_IN');
    this.state = {
      loggedIn: loggedIn,
      avatarUrl: null,
      avatarText: null
    };
    this.logIn = this.logIn.bind(this);
    this.logOut = this.logOut.bind(this);
    this.loadOAuthProfile = this.loadOAuthProfile.bind(this);
  }

  componentDidMount() {
    if (this.state.loggedIn) {
      this.loadOAuthProfile();
    }
  }

  logIn() {
    this.setState({loggedIn: true}, this.loadOAuthProfile);
  }

  logOut() {
    this.setState({loggedIn: false, avatarUrl: null, avatarText: null});
  }

  loadOAuthProfile() {
    doFetch("/api/user/oauth/me", "GET", null, {
      200: profile => this.setState({
        avatarUrl: profile?.picture || null,
        avatarText: this.buildAvatarText(profile)
      }),
      401: () => this.setState({avatarUrl: null, avatarText: null}),
      403: () => this.setState({avatarUrl: null, avatarText: null}),
      404: () => this.setState({avatarUrl: null, avatarText: null}),
      default: () => this.setState({avatarUrl: null, avatarText: null})
    });
  }

  buildAvatarText(profile) {
    const name = (profile?.name || "").trim();
    if (name) {
      const words = name.split(/\s+/).filter(Boolean);
      if (words.length > 1) {
        return (words[0][0] + words[1][0]).toUpperCase();
      }

      return name.slice(0, 2).toUpperCase();
    }

    const email = (profile?.email || "").trim();
    if (!email) {
      return null;
    }

    const localPart = email.split("@")[0];
    const tokens = localPart.split(/[._-]+/).filter(Boolean);
    if (tokens.length > 1) {
      return (tokens[0][0] + tokens[1][0]).toUpperCase();
    }

    return localPart.slice(0, 2).toUpperCase();
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
              {this.state.loggedIn
                ? <LogOutButton logOut={this.logOut} avatarUrl={this.state.avatarUrl} avatarText={this.state.avatarText}/>
                : <LoginRegisterButton logIn={this.logIn}/>}
            </Col>
          </Row>
        </Container>
      </div>
    );
  }
}

export default Header;
