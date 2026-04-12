import React, { Component } from 'react';
import { Col, Container, Row } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import Cookies from 'js-cookie';

import ProfileButton from '../profile/ProfileButton';
import LibraryButton from '../library/LibraryButton';
import LoginRegisterButton from '../auth/LoginRegisterButton';
import LogOutButton from '../auth/LogOutButton';
import { doFetch } from '../util/Fetcher';

import './Header.css';

type OAuthProfile = {
  picture?: string | null;
  name?: string | null;
  email?: string | null;
};

type HeaderState = {
  loggedIn: string | boolean | undefined;
  avatarUrl: string | null;
  avatarText: string | null;
};

class Header extends Component<Record<string, never>, HeaderState> {
  constructor(props: Record<string, never>) {
    super(props);
    const loggedIn = Cookies.get('TEMPVS_LOGGED_IN');
    this.state = {
      loggedIn,
      avatarUrl: null,
      avatarText: null,
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
    this.setState({ loggedIn: true }, this.loadOAuthProfile);
  }

  logOut() {
    this.setState({ loggedIn: false, avatarUrl: null, avatarText: null });
  }

  loadOAuthProfile() {
    const clearAvatar = () => this.setState({ avatarUrl: null, avatarText: null });
    doFetch('/api/user/oauth/me', 'GET', null, {
      200: profile => {
        const oauthProfile = profile as OAuthProfile;
        this.setState({
          avatarUrl: oauthProfile?.picture || null,
          avatarText: this.buildAvatarText(oauthProfile),
        });
      },
      401: clearAvatar,
      403: clearAvatar,
      404: clearAvatar,
      default: clearAvatar,
    });
  }

  buildAvatarText(profile?: OAuthProfile | null) {
    const name = (profile?.name || '').trim();
    if (name) {
      const words = name.split(/\s+/).filter(Boolean);
      if (words.length > 1) {
        return (words[0][0] + words[1][0]).toUpperCase();
      }

      return name.slice(0, 2).toUpperCase();
    }

    const email = (profile?.email || '').trim();
    if (!email) {
      return null;
    }

    const localPart = email.split('@')[0];
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
              {this.state.loggedIn && (
                <Link to="/profile">
                  <ProfileButton />
                </Link>
              )}
            </Col>
            <Col sm={6}>
              <Link to="/library">
                <LibraryButton />
              </Link>
            </Col>
            <Col sm={2} />
            <Col sm={1}>
              {this.state.loggedIn
                ? <LogOutButton logOut={this.logOut} avatarUrl={this.state.avatarUrl} avatarText={this.state.avatarText} />
                : <LoginRegisterButton />}
            </Col>
          </Row>
        </Container>
      </div>
    );
  }
}

export default Header;
