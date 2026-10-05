import React, { Component } from 'react';
import { Col, Container, Row } from 'react-bootstrap';
import { NavigateFunction, useNavigate } from 'react-router-dom';

import HomeButton from '../home/HomeButton';
import ProfileButton from '../profile/ProfileButton';
import LibraryButton from '../library/LibraryButton';
import ChatButton from '../chat/ChatButton';
import ClubButton from '../club/ClubButton';
import EventButton from '../event/EventButton';
import NotificationButton from '../notification/NotificationButton';
import SearchDialog from '../search/SearchDialog';
import LoginRegisterButton from '../auth/LoginRegisterButton';
import LogOutButton from '../auth/LogOutButton';
import { fetchClubProfiles, fetchCurrentUserInfo, fetchUserProfileByUserId } from '../profile/profileApi';
import {
  buildOwnedProfileOptions,
  CurrentProfileOption,
  resolveCurrentProfileOption,
  setStoredCurrentProfileValue,
} from '../profile/currentProfile';
import { Profile } from '../profile/profileTypes';
import ProfilePicker from '../profile/components/ProfilePicker';

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

type HeaderProps = {
  navigate: NavigateFunction;
};

class HeaderContent extends Component<HeaderProps, HeaderState> {
  constructor(props: HeaderProps) {
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
    this.loadOAuthProfile = this.loadOAuthProfile.bind(this);
    this.handleCurrentProfileChange = this.handleCurrentProfileChange.bind(this);
  }

  componentDidMount() {
    this.loadOAuthProfile();
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

  handleCurrentProfileChange(nextValue: string) {
    if (!nextValue || nextValue === this.state.currentProfileValue) {
      return;
    }

    const selectedOption = this.state.profileOptions.find(option => option.value === nextValue);
    setStoredCurrentProfileValue(nextValue);
    this.setState({
      currentProfileValue: nextValue,
      currentProfilePath: selectedOption?.path || '/profile',
    }, () => {
      this.props.navigate(selectedOption?.path || '/profile');
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
                  <HomeButton to="/" />
                  <ProfileButton to={this.state.currentProfilePath} />
                  <ProfilePicker
                    className="header-profile-select"
                    ariaLabel="Current profile"
                    value={this.state.currentProfileValue}
                    options={this.state.profileOptions}
                    onChange={this.handleCurrentProfileChange}
                  />
                </div>
              )}
            </Col>
            <Col sm={9}>
              <div className="header-main-actions">
                <SearchDialog />
                <ClubButton to="/clubs" />
                <EventButton to="/events" />
                {this.state.loggedIn && (
                  <>
                    <ChatButton to="/chat" />
                    <NotificationButton to="/notifications" />
                  </>
                )}
                <LibraryButton to="/library" />
              </div>
            </Col>
            <Col sm={1}>
              {this.state.loggedIn
                ? <LogOutButton avatarUrl={this.state.avatarUrl} avatarText={this.state.avatarText} />
                : <LoginRegisterButton />}
            </Col>
          </Row>
        </Container>
      </div>
    );
  }
}

export default function Header() {
  return <HeaderContent navigate={useNavigate()} />;
}
