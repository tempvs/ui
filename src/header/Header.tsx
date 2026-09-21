import React, { Component } from 'react';
import { Col, Container, Form, Row } from 'react-bootstrap';
import { Link } from 'react-router-dom';

import HomeButton from '../home/HomeButton';
import ProfileButton from '../profile/ProfileButton';
import LibraryButton from '../library/LibraryButton';
import ChatButton from '../chat/ChatButton';
import ClubButton from '../club/ClubButton';
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
  userId?: string | null;
};

type HeaderState = {
  loggedIn: boolean | undefined;
  avatarUrl: string | null;
  avatarText: string | null;
  currentUserId: string | null;
  currentProfileValue: string | null;
  currentProfilePath: string;
  profileOptions: CurrentProfileOption[];
};

class Header extends Component<Record<string, never>, HeaderState> {
  constructor(props: Record<string, never>) {
    super(props);
    this.state = {
      loggedIn: undefined,
      avatarUrl: null,
      avatarText: null,
      currentUserId: null,
      currentProfileValue: null,
      currentProfilePath: '/profile',
      profileOptions: [],
    };
    this.logOut = this.logOut.bind(this);
    this.loadOAuthProfile = this.loadOAuthProfile.bind(this);
    this.handleCurrentProfileChange = this.handleCurrentProfileChange.bind(this);
  }

  componentDidMount() {
    this.loadOAuthProfile();
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
      loggedIn: false,
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
        loggedIn: true,
        currentUserId: String(result.currentUserId),
      }, () => {
        this.loadOwnedProfiles(String(result.currentUserId));
      });
    });
  }

  loadOwnedProfiles(userId: string) {
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
            <Col sm={9}>
              <div className="header-main-actions">
                <SearchDialog />
                <Link to="/clubs" className="header-inline-link"><ClubButton /></Link>
                {this.state.loggedIn && (
                  <Link to="/chat" className="header-inline-link">
                    <ChatButton />
                  </Link>
                )}
                <Link to="/library" className="header-inline-link">
                  <LibraryButton />
                </Link>
              </div>
            </Col>
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
