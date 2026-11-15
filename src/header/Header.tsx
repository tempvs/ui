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
import SearchDialog from "../search/LazySearchDialog";
import LoginRegisterButton from "../auth/LoginRegisterButton";
import AccountMenu from "../auth/AccountMenu";
import {
  endSession,
  observeSessionResponses,
  SESSION_ENDED_STORAGE_KEY,
  subscribeSession,
} from "../auth/session";
import {
  fetchClubProfiles,
  fetchCurrentUserInfo,
  fetchUserProfileByUserId,
  getOnboardingPreferences,
  getOnboardingStatus,
  getProfileAvatar,
} from "../profile/profileApi";
import {
  buildOwnedProfileOptions,
  CurrentProfileOption,
  resolveCurrentProfileOption,
  setStoredCurrentProfileValue,
} from "../profile/currentProfile";
import { OauthProfile, Profile } from "../profile/profileTypes";
import ProfilePicker from "../profile/components/ProfilePicker";
import DismissibleCoachmark from "../component/DismissibleCoachmark";

import "./Header.css";

type HeaderState = {
  loggedIn: boolean | undefined;
  avatarUrl: string | null;
  avatarText: string | null;
  accountName: string | null;
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
  private onboardingRequest = 0;
  private sessionRequest = 0;
  private ownedProfilesRequest = 0;
  private mounted = false;
  private identityUserId: string | null = null;
  private sessionTimer?: number;
  private stopSessionSubscription?: () => void;
  private stopSessionObservation?: () => void;
  private handleSessionStorage = (event: StorageEvent) => {
    if (event.key === SESSION_ENDED_STORAGE_KEY) endSession(false);
  };
  private handlePageShow = (event: PageTransitionEvent) => {
    if (event.persisted) this.loadOAuthProfile(true);
  };
  private completedOnboardingUserId: string | null = null;
  private oauthProfile: OauthProfile | null = null;

  constructor(props: HeaderProps) {
    super(props);
    this.state = {
      loggedIn: undefined,
      avatarUrl: null,
      avatarText: null,
      accountName: null,
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
    this.handleWindowFocus = this.handleWindowFocus.bind(this);
    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
  }

  componentDidMount() {
    this.mounted = true;
    this.stopSessionObservation = observeSessionResponses();
    this.stopSessionSubscription = subscribeSession((session) => {
      this.sessionRequest++;
      this.applyCurrentUserInfo({
        currentUserId: session?.userId || null,
        oauthProfile: session,
      });
    });
    this.loadOAuthProfile();
    this.sessionTimer = window.setInterval(() => {
      if (this.identityUserId && document.visibilityState === "visible") this.loadOAuthProfile(true);
    }, 15_000);
    window.addEventListener("storage", this.handleSessionStorage);
    window.addEventListener("pageshow", this.handlePageShow);
    window.addEventListener(
      "tempvs:owned-profiles-changed",
      this.reloadOwnedProfiles,
    );
    window.addEventListener(
      "tempvs:onboarding-status-changed",
      this.reloadOnboardingStatus,
    );
    window.addEventListener("focus", this.handleWindowFocus);
    document.addEventListener(
      "visibilitychange",
      this.handleVisibilityChange,
    );
  }

  componentDidUpdate(previousProps: HeaderProps) {
    // Creation and source-linking flows can finish without remounting the
    // persistent header. Re-read when navigation completes so an earlier
    // in-memory onboarding result cannot keep a finished member prompted.
    if (previousProps.locationPath !== this.props.locationPath) {
      this.loadOAuthProfile(true);
      this.reloadOnboardingStatus();
    }
  }

  componentWillUnmount() {
    this.mounted = false;
    this.sessionRequest++;
    this.ownedProfilesRequest++;
    window.clearInterval(this.sessionTimer);
    this.stopSessionSubscription?.();
    this.stopSessionObservation?.();
    window.removeEventListener("storage", this.handleSessionStorage);
    window.removeEventListener("pageshow", this.handlePageShow);
    this.onboardingRequest += 1;
    window.removeEventListener(
      "tempvs:owned-profiles-changed",
      this.reloadOwnedProfiles,
    );
    window.removeEventListener(
      "tempvs:onboarding-status-changed",
      this.reloadOnboardingStatus,
    );
    window.removeEventListener("focus", this.handleWindowFocus);
    document.removeEventListener(
      "visibilitychange",
      this.handleVisibilityChange,
    );
  }

  handleWindowFocus() {
    this.loadOAuthProfile(true);
    this.reloadOnboardingStatus();
  }

  handleVisibilityChange() {
    if (document.visibilityState === "visible") {
      this.loadOAuthProfile(true);
      this.reloadOnboardingStatus();
    }
  }

  reloadOwnedProfiles() {
    if (this.state.currentUserId)
      this.loadOwnedProfiles(this.state.currentUserId);
  }

  reloadOnboardingStatus() {
    const userId = this.state.currentUserId;
    if (!userId) return;
    const request = ++this.onboardingRequest;
    void Promise.all([
      getOnboardingStatus(),
      getOnboardingPreferences().catch(() => null),
    ])
      .then(([status, preferences]) => {
        if (
          request !== this.onboardingRequest ||
          userId !== this.state.currentUserId
        )
          return;
        const counts = [
          status.personaCount,
          status.itemCount,
          status.sourcedItemCount,
          status.connectionCount,
        ];
        const complete = counts.every((count) => count > 0);
        if (complete || preferences?.celebratedAt)
          this.completedOnboardingUserId = userId;
        this.setState({
          // Partial reads use zero for unavailable services. They cannot prove
          // that setup is unfinished, and must never undo known completion.
          onboardingIncomplete:
            this.completedOnboardingUserId !== userId &&
            !preferences?.dismissedAt &&
            !status.partial &&
            counts.some((count) => count === 0),
        });
      })
      // A notification must not imply incomplete setup when the status cannot
      // be read (for example during a rolling API deployment).
      .catch(() => {
        if (
          request === this.onboardingRequest &&
          userId === this.state.currentUserId
        )
          this.setState({ onboardingIncomplete: false });
      });
  }

  loadOAuthProfile(force = false) {
    const request = ++this.sessionRequest;
    fetchCurrentUserInfo(
      (result) => {
        if (!this.mounted || request !== this.sessionRequest) return;
        this.applyCurrentUserInfo(result);
      },
      { force, onError: () => undefined },
    );
  }

  applyCurrentUserInfo(result: {
    currentUserId: string | null;
    oauthProfile?: OauthProfile | null;
  }) {
    if (!this.mounted) return;
    if (!result.currentUserId) {
      this.identityUserId = null;
      this.oauthProfile = null;
      this.completedOnboardingUserId = null;
      this.onboardingRequest++;
      this.ownedProfilesRequest++;
      this.setState({
        loggedIn: false,
        avatarUrl: null,
        avatarText: null,
        accountName: null,
        currentUserId: null,
        currentProfileValue: null,
        currentProfilePath: "/profile",
        profileOptions: [],
        onboardingIncomplete: false,
        showProfileNavigationCoachmark: false,
        showProfilePickerCoachmark: false,
      });
      return;
    }
    const userId = String(result.currentUserId);
    const sameUser = this.identityUserId === userId;
    this.identityUserId = userId;
    this.oauthProfile = result.oauthProfile || null;
    if (sameUser) return;
    const oauthProfile = this.oauthProfile;
    this.setState(
      {
        avatarUrl: oauthProfile?.picture || null,
        avatarText: this.buildAvatarText(oauthProfile),
        accountName: oauthProfile?.name?.trim() || null,
        loggedIn: true,
        currentUserId: userId,
      },
      () => {
        if (this.identityUserId !== userId) return;
        this.loadOwnedProfiles(userId);
        this.reloadOnboardingStatus();
      },
    );
  }

  loadOwnedProfiles(userId: string) {
    const request = ++this.ownedProfilesRequest;
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
      new Promise<Profile[] | null>((resolve) => {
        fetchClubProfiles(userId, {
          onSuccess: (profiles) =>
            resolve(Array.isArray(profiles) ? profiles : []),
          onError: () => resolve(null),
        });
      });

    Promise.all([toPromiseUserProfile(), toPromiseClubProfiles()])
      .then(([userProfileResult, clubProfilesResult]) => {
        if (
          !this.mounted ||
          request !== this.ownedProfilesRequest ||
          this.identityUserId !== userId
        )
          return;
        const clubProfiles = clubProfilesResult || [];
        const userProfile = userProfileResult.profile;
        const accountName =
          this.oauthProfile?.name?.trim() ||
          `${userProfile?.firstName || ""} ${
            userProfile?.lastName || ""
          }`.trim() ||
          userProfile?.nickName?.trim() ||
          null;
        const accountEmail =
          this.oauthProfile?.email || userProfile?.profileEmail;
        const googlePicture = this.oauthProfile?.picture || null;
        if (!googlePicture && userProfile?.id) {
          void getProfileAvatar(userProfile.id)
            .then((avatar) => {
              if (
                this.mounted &&
                request === this.ownedProfilesRequest &&
                this.identityUserId === userId
              )
                this.setState({
                  avatarUrl:
                    avatar?.thumbnailUrl ||
                    avatar?.url ||
                    userProfile.avatarUrl ||
                    null,
                });
            })
            .catch(() => undefined);
        }
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
          accountName,
          avatarText: this.buildAvatarText({ name: accountName, email: accountEmail }),
          avatarUrl: googlePicture || userProfile?.avatarUrl || null,
          profileOptions,
          currentProfileValue: currentProfile?.value || null,
          currentProfilePath: currentProfile?.path || "/profile",
          // When the user has no club profile, guide them back to their
          // current personal profile. Once they create a persona, the picker
          // takes over as the only header hint so the two prompts never
          // overlap.
          showProfileNavigationCoachmark:
            Boolean(userProfile) &&
            clubProfilesResult !== null &&
            clubProfiles.length === 0,
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
        if (
          !this.mounted ||
          request !== this.ownedProfilesRequest ||
          this.identityUserId !== userId
        )
          return;
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

  buildAvatarText(profile?: OauthProfile | null) {
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
                    className="header-profile-picker-coachmark"
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
                    profileId={this.state.profileOptions
                      .find(
                        (option) =>
                          option.value === this.state.currentProfileValue,
                      )
                      ?.profile?.id?.toString()}
                  />
                  <NotificationButton to="/notifications" />
                </>
              )}
              <LibraryButton to="/library" />
            </div>
            <div className="header-auth-control">
              {this.state.loggedIn ? (
                <AccountMenu
                  avatarUrl={this.state.avatarUrl}
                  avatarText={this.state.avatarText}
                  name={this.state.accountName}
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
