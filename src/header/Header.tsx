import React, { Component } from 'react';
import { Col, Container, Form, Row } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import Cookies from 'js-cookie';

import HomeButton from '../home/HomeButton';
import ProfileButton from '../profile/ProfileButton';
import LibraryButton from '../library/LibraryButton';
import ChatButton from '../chat/ChatButton';
import SearchDialog from '../search/SearchDialog';
import LoginRegisterButton from '../auth/LoginRegisterButton';
import LogOutButton from '../auth/LogOutButton';
import { fetchClubProfiles, fetchCurrentUserInfo, fetchUserProfileByUserId } from '../profile/profileApi';
import {
  buildOwnedProfileOptions,
  clearStoredCurrentProfileValue,
  CurrentProfileOption,
  resolveCurrentProfileOption,
  setStoredCurrentProfileValue,
} from '../profile/currentProfile';
import { Profile } from '../profile/profileTypes';

import './Header.css';

type OAuthProfile = {
  picture?: string | null;
  name?: string | null;
  email?: string | null;
  userId?: number | null;
};

type HeaderState = {
  loggedIn: string | boolean | undefined;
  avatarUrl: string | null;
  avatarText: string | null;
  currentUserId: number | null;
  currentProfileValue: string | null;
  currentProfilePath: string;
  profileOptions: CurrentProfileOption[];
};

class Header extends Component<Record<string, never>, HeaderState> {
  constructor(props: Record<string, never>) {
    super(props);
    const loggedIn = Cookies.get('TEMPVS_LOGGED_IN');
    this.state = {
      loggedIn,
      avatarUrl: null,
      avatarText: null,
      currentUserId: null,
      currentProfileValue: null,
      currentProfilePath: '/profile',
      profileOptions: [],
    };
    this.logIn = this.logIn.bind(this);
    this.logOut = this.logOut.bind(this);
    this.loadOAuthProfile = this.loadOAuthProfile.bind(this);
    this.handleCurrentProfileChange = this.handleCurrentProfileChange.bind(this);
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
    clearStoredCurrentProfileValue();
    this.setState({
      loggedIn: false,
      avatarUrl: null,
      avatarText: null,
      currentUserId: null,
      currentProfileValue: null,
      currentProfilePath: '/profile',
      profileOptions: [],
    });
  }

  loadOAuthProfile() {
    const clearAvatar = () => this.setState({
      avatarUrl: null,
      avatarText: null,
      currentUserId: null,
      currentProfileValue: null,
      currentProfilePath: '/profile',
      profileOptions: [],
    });
    fetchCurrentUserInfo(result => {
      if (!result.currentUserId) {
        clearAvatar();
        return;
      }

      const oauthProfile = (result.oauthProfile || null) as OAuthProfile | null;
      this.setState({
        avatarUrl: oauthProfile?.picture || null,
        avatarText: this.buildAvatarText(oauthProfile),
        currentUserId: Number(result.currentUserId),
      }, () => {
        this.loadOwnedProfiles(Number(result.currentUserId));
      });
    });
  }

  loadOwnedProfiles(userId: number) {
    const toPromiseUserProfile = () => new Promise<Profile | null>(resolve => {
      fetchUserProfileByUserId(userId, {
        onSuccess: profile => resolve(profile || null),
        onMissing: () => resolve(null),
        onError: () => resolve(null),
      });
    });

    const toPromiseClubProfiles = () => new Promise<Profile[]>(resolve => {
      fetchClubProfiles(userId, {
        onSuccess: profiles => resolve(Array.isArray(profiles) ? profiles : []),
        onError: () => resolve([]),
      });
    });

    Promise.all([toPromiseUserProfile(), toPromiseClubProfiles()])
      .then(([userProfile, clubProfiles]) => {
        const profileOptions = buildOwnedProfileOptions(userProfile, clubProfiles);
        const currentProfile = resolveCurrentProfileOption(profileOptions);
        this.setState({
          profileOptions,
          currentProfileValue: currentProfile?.value || null,
          currentProfilePath: currentProfile?.path || '/profile',
        });
      })
      .catch(() => {
        this.setState({
          profileOptions: buildOwnedProfileOptions(null, []),
          currentProfileValue: null,
          currentProfilePath: '/profile',
        });
      });
  }

  handleCurrentProfileChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const nextValue = event.target.value;
    if (!nextValue || nextValue === this.state.currentProfileValue) {
      return;
    }

    const selectedOption = this.state.profileOptions.find(option => option.value === nextValue);
    setStoredCurrentProfileValue(nextValue);
    this.setState({
      currentProfileValue: nextValue,
      currentProfilePath: selectedOption?.path || '/profile',
    }, () => {
      window.location.reload();
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
            <Col sm={2}>
              {this.state.loggedIn && (
                <div className="header-profile-switcher">
                  <Link to="/">
                    <HomeButton />
                  </Link>
                  <Link to={this.state.currentProfilePath} reloadDocument>
                    <ProfileButton />
                  </Link>
                  <Form.Select
                    className="header-profile-select"
                    value={this.state.currentProfileValue || ''}
                    onChange={this.handleCurrentProfileChange}
                  >
                    {this.state.profileOptions.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Form.Select>
                </div>
              )}
            </Col>
            <Col sm={4}>
              <SearchDialog />
            </Col>
            <Col sm={1}>
              {this.state.loggedIn && (
                <Link to="/chat">
                  <ChatButton />
                </Link>
              )}
            </Col>
            <Col sm={4}>
              <Link to="/library">
                <LibraryButton />
              </Link>
            </Col>
            <Col sm={1}>
              {this.state.loggedIn
                ? <LogOutButton logOut={this.logOut} avatarUrl={this.state.avatarUrl} avatarText={this.state.avatarText} />
                : <LoginRegisterButton logIn={this.logIn} />}
            </Col>
          </Row>
        </Container>
      </div>
    );
  }
}

export default Header;
