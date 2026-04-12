import React, { Component } from 'react';

import { Container, Row, Col } from 'react-bootstrap';
import { FaTrashAlt } from 'react-icons/fa';
import { injectIntl } from 'react-intl';
import { Link } from 'react-router-dom';

import IconActionButton from "../component/IconActionButton";
import SectionHeaderBar from "../component/SectionHeaderBar";
import Spinner from "../component/Spinner";
import { readFileAsBase64 } from "../util/fileUtils";
import { clearAllTimers, clearTimer, TimerRecord } from "../util/timers";
import { PERIODS, getPeriodLabel as getSharedPeriodLabel } from "../util/periods";
import ClubProfilesSection from "./components/ClubProfilesSection";
import CreateProfileForm from "./components/CreateProfileForm";
import ProfileAvatarPanel from "./components/ProfileAvatarPanel";
import ProfileFieldsPanel from "./components/ProfileFieldsPanel";
import ProfileHeaderBreadcrumb from "./components/ProfileHeaderBreadcrumb";
import {
  createClubProfile,
  createUserProfile,
  deleteAvatar,
  deleteProfile,
  fetchAvatar,
  fetchClubProfiles,
  fetchCurrentUserInfo,
  fetchOwnerUserProfile,
  fetchProfileById,
  updateAvatarDescription,
  updateProfile,
  uploadAvatar,
} from "./profileApi";
import {
  Avatar,
  Id,
  PersistedProfile,
  Profile,
  ProfileField,
  ProfilePageProps,
  ProfilePageState,
} from './profileTypes';

const AVATAR_MAX_DIMENSION = 1600;
const AVATAR_TARGET_BYTES = 900 * 1024;
const AVATAR_MIN_QUALITY = 0.55;
const AVATAR_PANEL_WIDTH = '18rem';

const TrashIcon = FaTrashAlt as React.ComponentType;

type ProfileInputChangeEvent =
  | React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  | { target: { name: string; value: string } };

class ProfilePage extends Component<ProfilePageProps, ProfilePageState> {
  autoSaveTimers: TimerRecord = {};
  statusResetTimers: TimerRecord = {};

  constructor(props: ProfilePageProps) {
    super(props);
    this.state = this.buildInitialState();
  }

  componentDidMount() {
    this.loadCurrentUserInfo();
    this.fetchProfile(this.props.id);
  }

  componentDidUpdate(prevProps: ProfilePageProps) {
    if (prevProps.id !== this.props.id) {
      this.clearAutoSaveTimers();
      this.setState(this.buildInitialState(), () => {
        this.loadCurrentUserInfo();
        this.fetchProfile(this.props.id);
      });
    }
  }

  componentWillUnmount() {
    this.clearAutoSaveTimers();
    clearAllTimers(this.statusResetTimers);
  }

  buildInitialState(): ProfilePageState {
    return {
      avatarVisible: false,
      avatarLoaded: false,
      loaded: false,
      notFound: false,
      createMode: false,
      currentUserId: null,
      oauthProfile: null,
      profileId: null,
      userId: null,
      type: null,
      firstName: '',
      lastName: '',
      nickName: '',
      profileEmail: '',
      location: '',
      alias: '',
      period: '',
      message: null,
      messageVariant: null,
      clubProfiles: [],
      clubProfilesLoaded: false,
      clubProfilesMessage: null,
      ownerUserProfile: null,
      ownerUserProfileLoaded: true,
      clubProfileCreateVisible: false,
      clubProfileCreateError: false,
      clubProfileDeleteTarget: null,
      clubProfileDeleteError: false,
      avatarUploadStatus: null,
      avatarUploadMessage: null,
      avatarDescriptionDraft: '',
      avatarDescriptionStatus: null,
      avatarDescriptionPersisted: '',
      persistedProfile: null,
      fieldStatuses: {},
    };
  }

  clearAutoSaveTimers() {
    clearAllTimers(this.autoSaveTimers);
    this.autoSaveTimers = {};
  }

  clearStatusResetTimer(fieldName: string) {
    clearTimer(this.statusResetTimers, fieldName);
  }

  loadCurrentUserInfo() {
    fetchCurrentUserInfo(result => this.setState(result));
  }

  fetchAvatar(profileId: Id) {
    fetchAvatar(profileId, {
      onSuccess: avatar => this.renderAvatar(avatar),
      onEmpty: () => this.setState({ avatarVisible: false, avatarLoaded: true }),
    });
  }

  fetchProfile(id: string | null | undefined) {
    fetchProfileById(id, {
      onSuccess: profile => this.renderProfile(profile),
      onMissing: () => this.handleMissingProfile(id),
    });
  }

  fetchClubProfiles(userId: Id | null | undefined) {
    if (!userId) {
      this.setState({ clubProfiles: [], clubProfilesLoaded: true, clubProfilesMessage: null });
      return;
    }

    this.setState({ clubProfilesLoaded: false, clubProfilesMessage: null });
    fetchClubProfiles(userId, {
      onSuccess: profiles => this.setState({
        clubProfiles: Array.isArray(profiles) ? profiles : [],
        clubProfilesLoaded: true,
        clubProfilesMessage: null,
      }),
      onError: () => this.setState({
        clubProfiles: [],
        clubProfilesLoaded: true,
        clubProfilesMessage: this.t('profile.clubProfiles.loadFailed', 'Unable to load club profiles.'),
      }),
    });
  }

  fetchOwnerUserProfile(userId: Id | null | undefined) {
    if (!userId) {
      this.setState({ ownerUserProfile: null, ownerUserProfileLoaded: true });
      return;
    }

    this.setState({ ownerUserProfileLoaded: false });
    fetchOwnerUserProfile(userId, {
      onSuccess: profile => this.setState({ ownerUserProfile: profile || null, ownerUserProfileLoaded: true }),
      onError: () => this.setState({ ownerUserProfile: null, ownerUserProfileLoaded: true }),
    });
  }

  handleMissingProfile(id: string | null | undefined) {
    if (id) {
      this.setState({ loaded: true, notFound: true, createMode: false });
      return;
    }

    this.setState({ loaded: true, notFound: true, createMode: true }, this.prefillProfileFromOAuth);
  }

  prefillProfileFromOAuth = () => {
    const profile = this.state.oauthProfile;
    if (!profile) {
      return;
    }

    const { firstName, lastName } = this.splitName(profile?.name, profile?.email);
    this.setState(prevState => ({
      firstName: prevState.firstName || firstName,
      lastName: prevState.lastName || lastName,
      profileEmail: prevState.profileEmail || profile?.email || '',
    }));
  };

  splitName(name?: string | null, email?: string | null) {
    const trimmedName = (name || '').trim();
    if (trimmedName) {
      const parts = trimmedName.split(/\s+/).filter(Boolean);
      return {
        firstName: parts[0] || '',
        lastName: parts.slice(1).join(' '),
      };
    }

    const localPart = (email || '').split('@')[0] || '';
    const tokens = localPart.split(/[._-]+/).filter(Boolean);
    return {
      firstName: tokens[0] || '',
      lastName: tokens.slice(1).join(' '),
    };
  }

  isEditableProfile() {
    if (!this.state.profileId || this.state.createMode || this.state.notFound) {
      return false;
    }

    return this.state.currentUserId != null && this.state.currentUserId === this.state.userId;
  }

  handleInputChange = (event: ProfileInputChangeEvent) => {
    const { name, value } = event.target;
    const fieldName = name as ProfileField;
    this.setState({ [fieldName]: value } as Pick<ProfilePageState, ProfileField>, () => {
      if (this.isEditableProfile()) {
        this.scheduleAutoSave(fieldName);
      }
    });
  };

  handleFieldBlur = (fieldName: ProfileField) => {
    if (!this.isEditableProfile()) {
      return;
    }

    this.clearFieldTimer(fieldName);
    this.saveField(fieldName);
  };

  clearFieldTimer(fieldName: string) {
    clearTimer(this.autoSaveTimers, fieldName);
  }

  scheduleAutoSave(fieldName: ProfileField) {
    this.clearFieldTimer(fieldName);
    this.clearStatusResetTimer(fieldName);
    this.setState(prevState => ({
      fieldStatuses: {
        ...prevState.fieldStatuses,
        [fieldName]: 'pending',
      },
    }));

    this.autoSaveTimers[fieldName] = setTimeout(() => {
      this.saveField(fieldName);
    }, 2000);
  }

  buildProfilePayload(): Record<string, string | null> {
    return {
      firstName: this.state.firstName,
      lastName: this.state.lastName,
      nickName: this.state.nickName || null,
      profileEmail: this.state.profileEmail || null,
      location: this.state.location || null,
      alias: this.state.alias || null,
      period: this.state.type === 'CLUB' ? (this.state.period || null) : null,
    };
  }

  buildPersistedProfile(profile: Profile): PersistedProfile {
    return {
      profileId: profile.id,
      userId: profile.userId ?? null,
      type: profile.type ?? null,
      firstName: profile.firstName || '',
      lastName: profile.lastName || '',
      nickName: profile.nickName || '',
      profileEmail: profile.profileEmail || '',
      location: profile.location || '',
      alias: profile.alias || '',
      period: profile.period || '',
    };
  }

  getCanonicalProfilePath(profile: { id?: Id | null; alias?: string | null } | null | undefined) {
    if (!profile) {
      return '/profile';
    }

    return `/profile/${profile.alias || profile.id}`;
  }

  t(id: string, defaultMessage: string, values?: Record<string, string | number | boolean | Date>) {
    return this.props.intl.formatMessage({ id, defaultMessage }, values);
  }

  getPeriodLabel(period?: string | null) {
    return getSharedPeriodLabel(this.props.intl, period);
  }

  resetFieldStatus(fieldName: ProfileField | 'avatarDescription', delay = 1000) {
    this.clearStatusResetTimer(fieldName);
    this.statusResetTimers[fieldName] = setTimeout(() => {
      if (fieldName === 'avatarDescription') {
        this.setState({ avatarDescriptionStatus: null });
      } else {
        this.setState(prevState => ({
          fieldStatuses: {
            ...prevState.fieldStatuses,
            [fieldName]: null,
          },
        }));
      }
      delete this.statusResetTimers[fieldName];
    }, delay);
  }

  async saveField(fieldName: ProfileField) {
    if (!this.isEditableProfile()) {
      return;
    }

    const persistedValue = this.state.persistedProfile?.[fieldName] || '';
    if ((this.state[fieldName] || '') === persistedValue) {
      this.setState(prevState => ({
        fieldStatuses: {
          ...prevState.fieldStatuses,
          [fieldName]: null,
        },
      }));
      return;
    }

    this.clearFieldTimer(fieldName);
    this.clearStatusResetTimer(fieldName);
    this.setState(prevState => ({
      fieldStatuses: {
        ...prevState.fieldStatuses,
        [fieldName]: 'saving',
      },
    }));

    try {
      const profileId = this.state.profileId;
      if (!profileId) {
        return;
      }

      const response = await updateProfile(profileId, this.buildProfilePayload());

      if (response.status === 200) {
        const profile = await response.json() as Profile;
        this.applyProfile(profile, false, fieldName);
        this.resetFieldStatus(fieldName);
        return;
      }

      this.handleFailedFieldSave(fieldName);
    } catch (error) {
      this.handleFailedFieldSave(fieldName);
    }
  }

  handleFailedFieldSave(fieldName: ProfileField) {
    this.setState(prevState => ({
      fieldStatuses: {
        ...prevState.fieldStatuses,
        [fieldName]: 'error',
      },
    }));

    this.clearStatusResetTimer(fieldName);
    this.statusResetTimers[fieldName] = setTimeout(() => {
      this.setState(prevState => ({
        [fieldName]: prevState.persistedProfile?.[fieldName] || '',
        fieldStatuses: {
          ...prevState.fieldStatuses,
          [fieldName]: null,
        },
      } as Pick<ProfilePageState, ProfileField | 'fieldStatuses'>));
      delete this.statusResetTimers[fieldName];
    }, 1500);
  }

  handleCreateProfile: React.FormEventHandler<HTMLFormElement> = event => {
    event.preventDefault();
    this.setState({ message: null, messageVariant: null });

    createUserProfile(event, {
      200: profile => this.renderProfile(profile as Profile),
      400: error => this.setState({
        message: this.extractCreateErrorMessage(error, this.t('profile.create.invalid', 'Unable to create profile. Check the required fields.')),
        messageVariant: 'error',
      }),
      401: () => this.setState({
        message: this.t('profile.create.signInRequired', 'You need to sign in before creating a profile.'),
        messageVariant: 'error',
      }),
      409: () => this.setState({
        message: this.t('profile.create.alreadyExists', 'User profile already exists.'),
        messageVariant: 'error',
      }),
      default: error => this.setState({
        message: this.extractCreateErrorMessage(error, this.t('profile.create.failed', 'Unable to create profile right now.')),
        messageVariant: 'error',
      }),
    });
  };

  handleCreateClubProfile: React.FormEventHandler<HTMLFormElement> = event => {
    event.preventDefault();
    this.setState({ clubProfileCreateError: false });

    createClubProfile(event, {
      200: profile => this.renderProfile(profile as Profile),
      400: () => this.setState({ clubProfileCreateError: true }),
      401: () => this.setState({ clubProfileCreateError: true }),
      409: () => this.setState({ clubProfileCreateError: true }),
      default: () => this.setState({ clubProfileCreateError: true }),
    });
  };

  handleOpenClubProfile = (clubProfile: Profile) => {
    const canonicalPath = this.getCanonicalProfilePath(clubProfile);
    if (window.location.pathname !== canonicalPath) {
      window.history.pushState(null, '', canonicalPath);
    }

    this.clearAutoSaveTimers();
    clearAllTimers(this.statusResetTimers);
    this.statusResetTimers = {};
    this.renderProfile(clubProfile);
  };

  handleDeleteClubProfile = async () => {
    const clubProfile = this.state.clubProfileDeleteTarget;
    if (!clubProfile) {
      return;
    }

    try {
      const response = await deleteProfile(clubProfile.id);

      if (response.status !== 200) {
        this.setState({ clubProfileDeleteError: true });
        return;
      }

      const deletingCurrentProfile = this.state.profileId === clubProfile.id;
      const ownerProfile = this.state.ownerUserProfile;

      this.setState(prevState => ({
        clubProfiles: prevState.clubProfiles.filter(profile => profile.id !== clubProfile.id),
        clubProfileDeleteTarget: null,
        clubProfileDeleteError: false,
      }));

      if (deletingCurrentProfile && ownerProfile) {
        this.renderProfile(ownerProfile);
        return;
      }

      this.fetchClubProfiles(clubProfile.userId);
    } catch (error) {
      this.setState({ clubProfileDeleteError: true });
    }
  };

  openDeleteClubProfileModal = (clubProfile: Profile) => {
    this.setState({
      clubProfileDeleteTarget: clubProfile,
      clubProfileDeleteError: false,
    });
  };

  closeDeleteClubProfileModal = () => {
    this.setState({
      clubProfileDeleteTarget: null,
      clubProfileDeleteError: false,
    });
  };

  extractCreateErrorMessage(error: unknown, fallback: string) {
    if (!error) {
      return fallback;
    }

    if (typeof error === 'string') {
      return error;
    }

    return fallback;
  }

  applyProfile(profile: Profile, refreshAvatar = true, savedField: ProfileField | null = null) {
    this.setState(prevState => ({
      loaded: true,
      notFound: false,
      createMode: false,
      profileId: profile.id,
      userId: profile.userId ?? null,
      type: profile.type ?? null,
      firstName: profile.firstName || '',
      lastName: profile.lastName || '',
      nickName: profile.nickName || '',
      profileEmail: profile.profileEmail || '',
      location: profile.location || '',
      alias: profile.alias || '',
      period: profile.period || '',
      message: null,
      messageVariant: null,
      persistedProfile: this.buildPersistedProfile(profile),
      fieldStatuses: savedField
        ? {
            ...prevState.fieldStatuses,
            [savedField]: 'saved',
          }
        : {},
      clubProfileCreateVisible: profile.type === 'USER' ? prevState.clubProfileCreateVisible : false,
      clubProfileCreateError: false,
    }));

    const canonicalPath = this.getCanonicalProfilePath(profile);
    if (window.location.pathname !== canonicalPath) {
      window.history.replaceState(null, '', canonicalPath);
    }

    if (refreshAvatar) {
      this.setState({ avatarVisible: false, avatarLoaded: false });
      this.fetchAvatar(profile.id);
    }

    this.fetchClubProfiles(profile.userId);
    this.fetchOwnerUserProfile(profile.userId);
  }

  renderProfile(profile: Profile) {
    this.applyProfile(profile, true);
  }

  renderAvatar(avatar: Avatar) {
    this.setState({
      avatarVisible: true,
      avatarLoaded: true,
      avatarImage: avatar.content,
      avatarUrl: avatar.url,
      avatarInfo: avatar.description,
      avatarDescriptionDraft: avatar.description || '',
      avatarDescriptionPersisted: avatar.description || '',
      avatarDescriptionStatus: null,
    });
  }

  handleAvatarUpload: React.ChangeEventHandler<HTMLInputElement> = async event => {
    const file = event.target.files?.[0];
    if (!file || !this.state.profileId) {
      return;
    }

    this.setState({
      avatarUploadStatus: 'uploading',
      avatarUploadMessage: null,
    });

    try {
      const preparedFile = await this.prepareAvatarFile(file);
      const content = await readFileAsBase64(preparedFile);
      const response = await uploadAvatar(this.state.profileId, {
        content,
        fileName: preparedFile.name,
        description: this.state.avatarDescriptionDraft || null,
      });

      if (response.status !== 200) {
        throw new Error('Upload failed');
      }

      this.setState({
        avatarUploadStatus: 'success',
        avatarUploadMessage: null,
        avatarVisible: false,
        avatarLoaded: false,
        avatarDescriptionStatus: null,
      });
      this.fetchAvatar(this.state.profileId);
    } catch (error) {
      this.setState({
        avatarUploadStatus: 'error',
        avatarUploadMessage: error instanceof Error ? error.message : this.t('profile.avatar.uploadFailed', 'Unable to upload profile picture.'),
      });
    } finally {
      event.target.value = '';
    }
  };

  async prepareAvatarFile(file: File): Promise<File> {
    if (!file.type.startsWith('image/')) {
      return file;
    }

    if (file.size <= AVATAR_TARGET_BYTES) {
      return file;
    }

    const image = await this.loadImage(file);
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) {
      return file;
    }

    let { width, height } = this.getScaledDimensions(image.width, image.height, AVATAR_MAX_DIMENSION);
    let quality = 0.9;
    let resizedFile = null;

    while (true) {
      canvas.width = width;
      canvas.height = height;
      context.clearRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);

      resizedFile = await this.canvasToFile(canvas, file.name, quality);
      if (!resizedFile) {
        return file;
      }

      if (resizedFile.size <= AVATAR_TARGET_BYTES) {
        return resizedFile;
      }

      if (quality > AVATAR_MIN_QUALITY) {
        quality = Math.max(quality - 0.1, AVATAR_MIN_QUALITY);
        continue;
      }

      if (Math.max(width, height) <= 800) {
        return resizedFile;
      }

      width = Math.max(Math.round(width * 0.85), 800);
      height = Math.max(Math.round(height * 0.85), 800);
      quality = 0.85;
    }
  }

  loadImage(file: File) {
    return new Promise<HTMLImageElement>((resolve, reject) => {
      const imageUrl = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => {
        URL.revokeObjectURL(imageUrl);
        resolve(image);
      };
      image.onerror = () => {
        URL.revokeObjectURL(imageUrl);
        reject(new Error(this.t('profile.avatar.processFailed', 'Unable to process the selected image.')));
      };
      image.src = imageUrl;
    });
  }

  getScaledDimensions(width: number, height: number, maxDimension: number) {
    if (Math.max(width, height) <= maxDimension) {
      return { width, height };
    }

    if (width >= height) {
      return {
        width: maxDimension,
        height: Math.max(Math.round((height / width) * maxDimension), 1),
      };
    }

    return {
      width: Math.max(Math.round((width / height) * maxDimension), 1),
      height: maxDimension,
    };
  }

  canvasToFile(canvas: HTMLCanvasElement, originalName: string, quality: number) {
    return new Promise<File>((resolve, reject) => {
      canvas.toBlob(blob => {
        if (!blob) {
          reject(new Error(this.t('profile.avatar.resizeFailed', 'Unable to resize the selected image.')));
          return;
        }

        const fileName = this.replaceFileExtension(originalName, 'jpg');
        resolve(new File([blob], fileName, { type: 'image/jpeg' }));
      }, 'image/jpeg', quality);
    });
  }

  replaceFileExtension(fileName: string, extension: string) {
    const normalizedName = fileName || 'avatar';
    const lastDotIndex = normalizedName.lastIndexOf('.');
    if (lastDotIndex === -1) {
      return `${normalizedName}.${extension}`;
    }

    return `${normalizedName.slice(0, lastDotIndex)}.${extension}`;
  }

  handleAvatarDescriptionChange: React.ChangeEventHandler<HTMLInputElement | HTMLTextAreaElement> = event => {
    const value = event.target.value;
    this.setState({
      avatarDescriptionDraft: value,
      avatarDescriptionStatus: value === this.state.avatarDescriptionPersisted ? null : 'pending',
    });
    this.clearFieldTimer('avatarDescription');
    this.clearStatusResetTimer('avatarDescription');
    this.autoSaveTimers.avatarDescription = setTimeout(() => {
      this.handleAvatarDescriptionSave();
    }, 1800);
  };

  handleAvatarDescriptionBlur = () => {
    this.clearFieldTimer('avatarDescription');
    this.handleAvatarDescriptionSave();
  };

  handleAvatarDescriptionSave = async () => {
    if (!this.isEditableProfile() || !this.state.avatarVisible || !this.state.profileId) {
      return;
    }

    const draft = this.state.avatarDescriptionDraft || '';
    const persisted = this.state.avatarDescriptionPersisted || '';
    if (draft === persisted) {
      this.setState({ avatarDescriptionStatus: null });
      return;
    }

    this.setState({ avatarDescriptionStatus: 'saving' });

    try {
      const response = await updateAvatarDescription(this.state.profileId, this.state.avatarDescriptionDraft || null);

      if (response.status !== 200) {
        throw new Error('Update failed');
      }

      this.setState({
        avatarInfo: draft,
        avatarDescriptionPersisted: draft,
        avatarDescriptionStatus: 'saved',
      });
      this.resetFieldStatus('avatarDescription');
    } catch (error) {
      this.setState({
        avatarDescriptionDraft: this.state.avatarDescriptionPersisted || '',
        avatarDescriptionStatus: 'error',
      });
      this.resetFieldStatus('avatarDescription', 1500);
    }
  };

  handleDeleteAvatar = async () => {
    if (!this.isEditableProfile() || !this.state.profileId) {
      return;
    }

    try {
      const response = await deleteAvatar(this.state.profileId);

      if (response.status !== 200) {
        throw new Error('Delete failed');
      }

      this.clearFieldTimer('avatarDescription');
      this.setState({
        avatarVisible: false,
        avatarLoaded: true,
        avatarUrl: null,
        avatarImage: null,
        avatarInfo: '',
        avatarDescriptionDraft: '',
        avatarDescriptionPersisted: '',
        avatarDescriptionStatus: null,
        avatarUploadMessage: null,
        avatarUploadStatus: 'success',
      });
    } catch (error) {
      this.setState({
        avatarUploadMessage: this.t('profile.avatar.deleteFailed', 'Unable to delete profile picture.'),
        avatarUploadStatus: 'error',
      });
    }
  };

  openAvatarFilePicker = () => {
    if (!this.isEditableProfile() || this.state.avatarUploadStatus === 'uploading') {
      return;
    }

    const input = document.getElementById('avatarUploadInput');
    if (input) {
      input.click();
    }
  };

  renderCreateProfile() {
    return (
      <CreateProfileForm
        firstName={this.state.firstName}
        lastName={this.state.lastName}
        nickName={this.state.nickName}
        profileEmail={this.state.profileEmail}
        location={this.state.location}
        alias={this.state.alias}
        isErrorMessage={this.state.messageVariant === 'error'}
        t={this.t.bind(this)}
        onChange={this.handleInputChange}
        onSubmit={this.handleCreateProfile}
      />
    );
  }

  renderProfileView() {
    const isEditable = this.isEditableProfile();
    const isClubProfile = this.state.type === 'CLUB';
    const headerSubtitleDisplay = isClubProfile
      ? `Club profile${this.state.period ? ` • ${this.getPeriodLabel(this.state.period)}` : ''}`
      : 'User profile';
    const ownerLink = isClubProfile && this.state.ownerUserProfile
      ? this.getCanonicalProfilePath(this.state.ownerUserProfile)
      : null;
    const ownerLabel = isClubProfile && this.state.ownerUserProfile
      ? `${this.state.ownerUserProfile.firstName} ${this.state.ownerUserProfile.lastName}`.trim()
      : null;
    const siblingClubProfiles = this.state.clubProfiles.filter(clubProfile => clubProfile.id !== this.state.profileId);
    const visibleClubProfiles = this.state.clubProfiles.filter(clubProfile => {
      if (clubProfile.id === this.state.profileId && this.state.type === 'CLUB') {
        return false;
      }

      return true;
    });
    const showEmptyClubProfiles = this.state.type === 'USER' && !visibleClubProfiles.length && !this.state.clubProfilesMessage;
    const profileInitials = `${(this.state.firstName || '').trim()[0] || ''}${(this.state.lastName || '').trim()[0] || ''}`.toUpperCase() || 'P';

    return (
      <Container fluid className="px-4 px-xl-5">
        <Row>
          <Col sm={12} className="mb-3">
            <SectionHeaderBar
              title={headerSubtitleDisplay}
              rightContent={(
                <ProfileHeaderBreadcrumb
                  ownerLink={ownerLink}
                  ownerLabel={ownerLabel}
                  currentProfile={{
                    id: this.state.profileId || undefined,
                    alias: this.state.alias,
                    firstName: this.state.firstName,
                    lastName: this.state.lastName,
                    period: this.state.period,
                  }}
                  siblingClubProfiles={siblingClubProfiles}
                  getCanonicalProfilePath={this.getCanonicalProfilePath.bind(this)}
                  getPeriodLabel={this.getPeriodLabel.bind(this)}
                  emptyLabel={this.t('profile.clubProfiles.noneOther', 'No other club profiles')}
                />
              )}
              backgroundColor={isClubProfile ? '#f8f4ea' : '#eef5ff'}
              borderColor={isClubProfile ? '#d8c7a1' : '#bfd3f2'}
            />
          </Col>
        </Row>
        <Row className="g-4 align-items-start">
          <Col lg={3} md={4}>
            <ProfileAvatarPanel
              avatarPanelWidth={AVATAR_PANEL_WIDTH}
              avatarVisible={this.state.avatarVisible}
              avatarLoaded={this.state.avatarLoaded}
              avatarImage={this.state.avatarImage}
              avatarUrl={this.state.avatarUrl}
              avatarInfo={this.state.avatarInfo}
              avatarUploadStatus={this.state.avatarUploadStatus}
              avatarUploadMessage={this.state.avatarUploadMessage}
              avatarDescriptionDraft={this.state.avatarDescriptionDraft}
              avatarDescriptionStatus={this.state.avatarDescriptionStatus}
              isEditable={isEditable}
              initials={profileInitials}
              t={this.t.bind(this)}
              onUploadChange={this.handleAvatarUpload}
              onOpenFilePicker={this.openAvatarFilePicker}
              onDelete={this.handleDeleteAvatar}
              onDescriptionChange={this.handleAvatarDescriptionChange}
              onDescriptionBlur={this.handleAvatarDescriptionBlur}
            />
          </Col>
          <Col lg={5} md={8}>
            <ProfileFieldsPanel
              type={this.state.type}
              state={this.state}
              periods={[...PERIODS]}
              t={this.t.bind(this)}
              getPeriodLabel={this.getPeriodLabel.bind(this)}
              editable={isEditable}
              onInputChange={this.handleInputChange}
              onFieldBlur={this.handleFieldBlur}
            />
          </Col>
          <Col lg={4} md={12}>
            {isClubProfile && (
              <div className="mb-3">
                {isEditable && (
                  <div className="d-flex justify-content-end mb-2">
                    <IconActionButton
                      size="1.9rem"
                      fontSize="0.9rem"
                      onClick={() => this.openDeleteClubProfileModal({
                        id: this.state.profileId || '',
                        firstName: this.state.firstName,
                        lastName: this.state.lastName,
                        userId: this.state.userId,
                      })}
                      title={this.t('profile.clubProfile.delete.title', 'Delete club profile')}
                    >
                      <TrashIcon />
                    </IconActionButton>
                  </div>
                )}
                <div className="d-flex justify-content-start">
                  <Link
                    to={`/stash/${this.state.alias || this.state.profileId}`}
                    className="btn btn-outline-secondary"
                    style={{ minWidth: '9.5rem' }}
                  >
                    {this.t('profile.stash.button', 'Stash')}
                  </Link>
                </div>
              </div>
            )}
            <ClubProfilesSection
              isUserProfile={this.state.type === 'USER'}
              canCreate={isEditable}
              visibleClubProfiles={this.state.type === 'USER' ? visibleClubProfiles : []}
              showEmptyMessage={this.state.type === 'USER' ? showEmptyClubProfiles : false}
              clubProfilesLoaded={this.state.clubProfilesLoaded}
              clubProfilesMessage={this.state.type === 'USER' ? this.state.clubProfilesMessage : null}
              clubProfileCreateVisible={this.state.clubProfileCreateVisible}
              clubProfileCreateError={this.state.clubProfileCreateError}
              clubProfileDeleteTarget={this.state.clubProfileDeleteTarget}
              clubProfileDeleteError={this.state.clubProfileDeleteError}
              periods={[...PERIODS]}
              getPeriodLabel={this.getPeriodLabel.bind(this)}
              t={this.t.bind(this)}
              onShowCreate={() => this.setState({ clubProfileCreateVisible: true, clubProfileCreateError: false })}
              onHideCreate={() => this.setState({ clubProfileCreateVisible: false, clubProfileCreateError: false })}
              onCreate={this.handleCreateClubProfile}
              onOpenProfile={this.handleOpenClubProfile}
              onOpenDelete={this.openDeleteClubProfileModal}
              onHideDelete={this.closeDeleteClubProfileModal}
              onDelete={this.handleDeleteClubProfile}
            />
          </Col>
        </Row>
      </Container>
    );
  }

  renderNotFound() {
    return (
      <Container>
        <Row>
          <Col sm={12}>
            {this.t('profile.notFound', 'Profile not found.')}
          </Col>
        </Row>
      </Container>
    );
  }

  render() {
    if (!this.state.loaded) {
      return <Spinner />;
    }

    if (this.state.createMode) {
      return this.renderCreateProfile();
    }

    if (this.state.notFound) {
      return this.renderNotFound();
    }

    return this.renderProfileView();
  }
}

export default injectIntl(ProfilePage);

