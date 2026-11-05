import React, { Component } from "react";
import { Container } from "react-bootstrap";
import { NavigateFunction, useLocation, useNavigate } from "react-router-dom";

import HomeButton from "../home/HomeButton";
import ProfileButton from "../profile/ProfileButton";
import LibraryButton from "../library/LibraryButton";
import ChatButton from "../chat/ChatButton";
import ClubButton from "../club/ClubButton";
import EventButton from "../event/EventButton";
import MapButton from "../map/MapButton";
import NotificationButton from "../notification/NotificationButton";
import SearchDialog from "../search/SearchDialog";
import LoginRegisterButton from "../auth/LoginRegisterButton";
import LogOutButton from "../auth/LogOutButton";
import {
  fetchClubProfiles,
  fetchCurrentUserInfo,
  fetchUserProfileByUserId,
  getOnboardingStatus,
} from "../profile/profileApi";
import {
  buildOwnedProfileOptions,
  CurrentProfileOption,
  resolveCurrentProfileOption,
  setStoredCurrentProfileValue,
} from "../profile/currentProfile";
import { Profile } from "../profile/profileTypes";
import ProfilePicker from "../profile/components/ProfilePicker";
import DismissibleCoachmark from "../component/DismissibleCoachmark";

import "./Header.css";

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
  showProfileNavigationCoachmark: boolean;
  profileNavigationCoachmarkId: string;
  showProfilePickerCoachmark: boolean;
  onboardingIncomplete: boolean;
};

type HeaderProps = {
  locationPath: string;
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
      currentProfilePath: "/profile",
      profileOptions: [],
      showProfileNavigationCoachmark: false,
      profileNavigationCoachmarkId: "open-current-profile",
      showProfilePickerCoachmark: false,
      onboardingIncomplete: false,
    };
    this.loadOAuthProfile = this.loadOAuthProfile.bind(this);
    this.handleCurrentProfileChange =
      this.handleCurrentProfileChange.bind(this);
    this.reloadOwnedProfiles = this.reloadOwnedProfiles.bind(this);
    this.reloadOnboardingStatus = this.reloadOnboardingStatus.bind(this);
  }

  componentDidMount() {
    this.loadOAuthProfile();
    window.addEventListener(
      "tempvs:owned-profiles-changed",
      this.reloadOwnedProfiles,
    );
    window.addEventListener(
      "tempvs:onboarding-status-changed",
      this.reloadOnboardingStatus,
    );
  }

  componentWillUnmount() {
    window.removeEventListener(
      "tempvs:owned-profiles-changed",
      this.reloadOwnedProfiles,
    );
    window.removeEventListener(
      "tempvs:onboarding-status-changed",
      this.reloadOnboardingStatus,
    );
  }

  reloadOwnedProfiles() {
    if (this.state.currentUserId)
      this.loadOwnedProfiles(this.state.currentUserId);
  }

  reloadOnboardingStatus() {
    if (!this.state.currentUserId) return;
    void getOnboardingStatus()
      .then((status) => {
        this.setState({
          onboardingIncomplete:
            status.personaCount === 0 ||
            status.itemCount === 0 ||
            status.sourcedItemCount === 0 ||
            status.connectionCount === 0,
        });
      })
      // A notification must not imply incomplete setup when the status cannot
      // be read (for example during a rolling API deployment).
      .catch(() => this.setState({ onboardingIncomplete: false }));
  }

  loadOAuthProfile() {
    const clearAvatar = () =>
      this.setState({
        loggedIn: false,
        avatarUrl: null,
        avatarText: null,
        currentUserId: null,
        currentProfileValue: null,
        currentProfilePath: "/profile",
        profileOptions: [],
        onboardingIncomplete: false,
      });
    fetchCurrentUserInfo((result) => {
      if (!result.currentUserId) {
        clearAvatar();
        return;
      }

      const oauthProfile = (result.oauthProfile || null) as OAuthProfile | null;
      this.setState(
        {
          avatarUrl: oauthProfile?.picture || null,
          avatarText: this.buildAvatarText(oauthProfile),
          loggedIn: true,
          currentUserId: String(result.currentUserId),
        },
        () => {
          this.loadOwnedProfiles(String(result.currentUserId));
          this.reloadOnboardingStatus();
        },
      );
    });
  }

  loadOwnedProfiles(userId: string) {
    const toPromiseUserProfile = () =>
      new Promise<{ profile: Profile | null; missing: boolean }>((resolve) => {
        fetchUserProfileByUserId(userId, {
          onSuccess: (profile) =>
            resolve({ profile: profile || null, missing: false }),
          onMissing: () => resolve({ profile: null, missing: true }),
          // A transient profile-service error must never send an established
          // user into profile creation. Only an explicit 404 is a new user.
          onError: () => resolve({ profile: null, missing: false }),
        });
      });

    const toPromiseClubProfiles = () =>
      new Promise<Profile[]>((resolve) => {
        fetchClubProfiles(userId, {
          onSuccess: (profiles) =>
            resolve(Array.isArray(profiles) ? profiles : []),
          onError: () => resolve([]),
        });
      });

    Promise.all([toPromiseUserProfile(), toPromiseClubProfiles()])
      .then(([userProfileResult, clubProfiles]) => {
        const userProfile = userProfileResult.profile;
        const profileOptions = buildOwnedProfileOptions(
          userProfile,
          clubProfiles,
        );
        const currentProfile = resolveCurrentProfileOption(profileOptions);
        const showProfilePickerCoachmark =
          clubProfiles.length > 0 &&
          window.sessionStorage.getItem(
            "tempvs:coachmark:pick-current-profile",
          ) === "pending";
        if (showProfilePickerCoachmark)
          window.sessionStorage.removeItem(
            "tempvs:coachmark:pick-current-profile",
          );
        this.setState({
          profileOptions,
          currentProfileValue: currentProfile?.value || null,
          currentProfilePath: currentProfile?.path || "/profile",
          // A member with a personal profile but no persona cannot have
          // completed setup. This deliberately remains a reliable first-use
          // fallback if the aggregate onboarding endpoint is briefly
          // unavailable after registration or deployment.
          onboardingIncomplete:
            Boolean(userProfile) && clubProfiles.length === 0
              ? true
              : this.state.onboardingIncomplete,
          // When the user has no club profile, guide them back to their
          // current personal profile. Once they create a persona, the picker
          // takes over as the only header hint so the two prompts never
          // overlap.
          showProfileNavigationCoachmark:
            Boolean(userProfile) && clubProfiles.length === 0,
          profileNavigationCoachmarkId: "open-current-profile",
          showProfilePickerCoachmark,
        });
        // A new Cognito user has no personal profile yet. Apply this guard in
        // the persistent header so it covers both password and Google sign-in
        // from any public page, not merely the landing page.
        if (
          userProfileResult.missing &&
          this.props.locationPath !== "/profile"
        ) {
          this.props.navigate("/profile", { replace: true });
        }
      })
      .catch(() => {
        this.setState({
          profileOptions: buildOwnedProfileOptions(null, []),
          currentProfileValue: null,
          currentProfilePath: "/profile",
        });
      });
  }

  handleCurrentProfileChange(nextValue: string) {
    if (!nextValue || nextValue === this.state.currentProfileValue) {
      return;
    }

    const selectedOption = this.state.profileOptions.find(
      (option) => option.value === nextValue,
    );
    setStoredCurrentProfileValue(nextValue);
    this.setState({
      currentProfileValue: nextValue,
      currentProfilePath: selectedOption?.path || "/profile",
    });
  }

  buildAvatarText(profile?: OAuthProfile | null) {
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
          <div className="header-layout">
            <div className="header-profile-switcher">
              <DismissibleCoachmark
                id={`resume-onboarding-from-home:${this.state.currentUserId || "anonymous"}`}
                placement="below"
                visible={
                  this.state.loggedIn === true &&
                  this.state.onboardingIncomplete &&
                  this.props.locationPath !== "/"
                }
                message="Your setup is still in progress. Select Home to continue."
              >
                <HomeButton to="/" attention={this.state.onboardingIncomplete} />
              </DismissibleCoachmark>
              {this.state.loggedIn && (
                <>
                  <ProfileButton
                    to={this.state.currentProfilePath}
                    showNavigationCoachmark={
                      this.state.showProfileNavigationCoachmark
                    }
                    navigationCoachmarkId={`${this.state.profileNavigationCoachmarkId}:${this.state.currentUserId || "anonymous"}`}
                  />
                  <DismissibleCoachmark
                    id={`pick-current-profile:${this.state.currentUserId || "anonymous"}`}
                    visible={this.state.showProfilePickerCoachmark}
                    message="Pick your current profile here."
                  >
                    <ProfilePicker
                      className="header-profile-select"
                      ariaLabel="Current profile"
                      value={this.state.currentProfileValue}
                      options={this.state.profileOptions}
                      onChange={this.handleCurrentProfileChange}
                    />
                  </DismissibleCoachmark>
                </>
              )}
            </div>
            <div className="header-main-actions">
              <SearchDialog />
              <ClubButton to="/clubs" />
              <EventButton to="/events" />
              <MapButton />
              {this.state.loggedIn && (
                <>
                  <ChatButton
                    to="/chat"
                    profileId={this.state.profileOptions.find(
                      option => option.value === this.state.currentProfileValue,
                    )?.profile?.id?.toString()}
                  />
                  <NotificationButton to="/notifications" />
                </>
              )}
              <LibraryButton to="/library" />
            </div>
            <div className="header-auth-control">
              {this.state.loggedIn ? (
                <LogOutButton
                  avatarUrl={this.state.avatarUrl}
                  avatarText={this.state.avatarText}
                />
              ) : (
                <LoginRegisterButton />
              )}
            </div>
          </div>
        </Container>
      </div>
    );
  }
}

export default function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  return <HeaderContent locationPath={location.pathname} navigate={navigate} />;
}
