import React, { Component } from 'react';

import { Container, Form, Row, Col, Button, Dropdown, Modal } from 'react-bootstrap';
import { FaHourglassHalf, FaPlus, FaTimes, FaTrashAlt, FaUpload } from 'react-icons/fa';
import { injectIntl } from 'react-intl';

import { doFetch } from "../util/Fetcher.js";
import ModalImage from "../component/ModalImage";
import Spinner from "../component/Spinner";

const periods = [
  'ANCIENT',
  'ANTIQUITY',
  'EARLY_MIDDLE_AGES',
  'HIGH_MIDDLE_AGES',
  'LATE_MIDDLE_AGES',
  'RENAISSANCE',
  'MODERN',
  'WWI',
  'WWII',
  'CONTEMPORARY',
  'OTHER',
];

const periodLabelIds = {
  ANCIENT: 'period.ancient.heading',
  ANTIQUITY: 'period.antiquity.heading',
  EARLY_MIDDLE_AGES: 'period.early_middle_ages.heading',
  HIGH_MIDDLE_AGES: 'period.high_middle_ages.heading',
  LATE_MIDDLE_AGES: 'period.late_middle_ages.heading',
  RENAISSANCE: 'period.renaissance.heading',
  MODERN: 'period.modern.heading',
  WWI: 'period.wwi.heading',
  WWII: 'period.wwii.heading',
  CONTEMPORARY: 'period.contemporary.heading',
  OTHER: 'period.other.heading',
};

const AVATAR_MAX_DIMENSION = 1600;
const AVATAR_TARGET_BYTES = 900 * 1024;
const AVATAR_MIN_QUALITY = 0.55;
const AVATAR_PANEL_WIDTH = '18rem';

class ProfilePage extends Component {
  autoSaveTimers = {};
  statusResetTimers = {};

  constructor() {
    super();
    this.state = this.buildInitialState();
  }

  componentDidMount() {
    this.loadCurrentUserInfo();
    this.fetchProfile(this.props.id);
  }

  componentDidUpdate(prevProps) {
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
    Object.values(this.statusResetTimers).forEach(timerId => clearTimeout(timerId));
  }

  buildInitialState() {
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
    Object.values(this.autoSaveTimers).forEach(timerId => clearTimeout(timerId));
    this.autoSaveTimers = {};
  }

  clearStatusResetTimer(fieldName) {
    if (this.statusResetTimers[fieldName]) {
      clearTimeout(this.statusResetTimers[fieldName]);
      delete this.statusResetTimers[fieldName];
    }
  }

  loadCurrentUserInfo() {
    doFetch("/api/user/oauth/me", "GET", null, {
      200: profile => this.setState({ currentUserId: profile?.userId || null, oauthProfile: profile || null }),
      401: () => this.setState({ currentUserId: null, oauthProfile: null }),
      404: () => this.setState({ currentUserId: null, oauthProfile: null }),
      default: () => this.setState({ currentUserId: null, oauthProfile: null }),
    });
  }

  fetchAvatar(profileId) {
    const url = `/api/image/image/profile/${profileId}`;
    doFetch(url, "GET", null, {
      200: avatars => {
        if (avatars?.length) {
          this.renderAvatar(avatars[0]);
          return;
        }
        this.setState({ avatarVisible: false, avatarLoaded: true });
      },
      404: () => this.setState({ avatarVisible: false, avatarLoaded: true }),
      500: () => this.setState({ avatarVisible: false, avatarLoaded: true }),
      503: () => this.setState({ avatarVisible: false, avatarLoaded: true }),
      default: () => this.setState({ avatarVisible: false, avatarLoaded: true }),
    });
  }

  fetchProfile(id) {
    const url = id ? `/api/profile/profile/${id}` : '/api/profile/profile';
    doFetch(url, "GET", null, {
      200: profile => this.renderProfile(profile),
      404: () => this.handleMissingProfile(id),
    });
  }

  fetchClubProfiles(userId) {
    if (!userId) {
      this.setState({ clubProfiles: [], clubProfilesLoaded: true, clubProfilesMessage: null });
      return;
    }

    this.setState({ clubProfilesLoaded: false, clubProfilesMessage: null });
    doFetch(`/api/profile/club-profile?userId=${userId}`, "GET", null, {
      200: profiles => this.setState({
        clubProfiles: Array.isArray(profiles) ? profiles : [],
        clubProfilesLoaded: true,
        clubProfilesMessage: null,
      }),
      default: () => this.setState({
        clubProfiles: [],
        clubProfilesLoaded: true,
        clubProfilesMessage: this.t('profile.clubProfiles.loadFailed', 'Unable to load club profiles.'),
      }),
    });
  }

  fetchOwnerUserProfile(userId) {
    if (!userId) {
      this.setState({ ownerUserProfile: null, ownerUserProfileLoaded: true });
      return;
    }

    this.setState({ ownerUserProfileLoaded: false });
    doFetch(`/api/profile/user-profile?userId=${userId}`, "GET", null, {
      200: profile => this.setState({ ownerUserProfile: profile || null, ownerUserProfileLoaded: true }),
      default: () => this.setState({ ownerUserProfile: null, ownerUserProfileLoaded: true }),
    });
  }

  handleMissingProfile(id) {
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

  splitName(name, email) {
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

  handleInputChange = (event) => {
    const { name, value } = event.target;
    this.setState({ [name]: value }, () => {
      if (this.isEditableProfile()) {
        this.scheduleAutoSave(name);
      }
    });
  };

  handleFieldBlur = (fieldName) => {
    if (!this.isEditableProfile()) {
      return;
    }

    this.clearFieldTimer(fieldName);
    this.saveField(fieldName);
  };

  clearFieldTimer(fieldName) {
    if (this.autoSaveTimers[fieldName]) {
      clearTimeout(this.autoSaveTimers[fieldName]);
      delete this.autoSaveTimers[fieldName];
    }
  }

  scheduleAutoSave(fieldName) {
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

  buildProfilePayload() {
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

  buildPersistedProfile(profile) {
    return {
      profileId: profile.id,
      userId: profile.userId,
      type: profile.type,
      firstName: profile.firstName || '',
      lastName: profile.lastName || '',
      nickName: profile.nickName || '',
      profileEmail: profile.profileEmail || '',
      location: profile.location || '',
      alias: profile.alias || '',
      period: profile.period || '',
    };
  }

  getCanonicalProfilePath(profile) {
    return `/profile/${profile.alias || profile.id}`;
  }

  t(id, defaultMessage, values) {
    return this.props.intl.formatMessage({ id, defaultMessage }, values);
  }

  getPeriodLabel(period) {
    if (!period) {
      return '';
    }

    return this.t(periodLabelIds[period], period);
  }

  resetFieldStatus(fieldName, delay = 1000) {
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

  async saveField(fieldName) {
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
      const response = await fetch(`/api/profile/profile/${this.state.profileId}`, {
        method: 'PUT',
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(this.buildProfilePayload()),
      });

      if (response.status === 200) {
        const profile = await response.json();
        this.applyProfile(profile, false, fieldName);
        this.resetFieldStatus(fieldName);
        return;
      }

      this.handleFailedFieldSave(fieldName);
    } catch (error) {
      this.handleFailedFieldSave(fieldName);
    }
  }

  handleFailedFieldSave(fieldName) {
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
      }));
      delete this.statusResetTimers[fieldName];
    }, 1500);
  }

  handleCreateProfile = (event) => {
    event.preventDefault();
    this.setState({ message: null, messageVariant: null });

    doFetch('/api/profile/user-profile', 'POST', event, {
      200: profile => this.renderProfile(profile),
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

  handleCreateClubProfile = (event) => {
    event.preventDefault();
    this.setState({ clubProfileCreateError: false });

    doFetch('/api/profile/club-profile', 'POST', event, {
      200: profile => this.renderProfile(profile),
      400: () => this.setState({ clubProfileCreateError: true }),
      401: () => this.setState({ clubProfileCreateError: true }),
      409: () => this.setState({ clubProfileCreateError: true }),
      default: () => this.setState({ clubProfileCreateError: true }),
    });
  };

  handleOpenClubProfile = (clubProfile) => {
    const canonicalPath = this.getCanonicalProfilePath(clubProfile);
    if (window.location.pathname !== canonicalPath) {
      window.history.pushState(null, '', canonicalPath);
    }

    this.clearAutoSaveTimers();
    Object.values(this.statusResetTimers).forEach(timerId => clearTimeout(timerId));
    this.statusResetTimers = {};
    this.renderProfile(clubProfile);
  };

  handleDeleteClubProfile = async () => {
    const clubProfile = this.state.clubProfileDeleteTarget;
    if (!clubProfile) {
      return;
    }

    try {
      const response = await fetch(`/api/profile/profile/${clubProfile.id}`, {
        method: 'DELETE',
      });

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

  openDeleteClubProfileModal = (clubProfile) => {
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

  extractCreateErrorMessage(error, fallback) {
    if (!error) {
      return fallback;
    }

    if (typeof error === 'string') {
      return error;
    }

    return fallback;
  }

  applyProfile(profile, refreshAvatar = true, savedField = null) {
    this.setState(prevState => ({
      loaded: true,
      notFound: false,
      createMode: false,
      profileId: profile.id,
      userId: profile.userId,
      type: profile.type,
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

  renderProfile(profile) {
    this.applyProfile(profile, true);
  }

  renderAvatar(avatar) {
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

  handleAvatarUpload = async (event) => {
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
      const content = await this.readFileAsBase64(preparedFile);
      const response = await fetch(`/api/profile/profile/${this.state.profileId}/avatar`, {
        method: 'POST',
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          content,
          fileName: preparedFile.name,
          description: this.state.avatarDescriptionDraft || null,
        }),
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
        avatarUploadMessage: error?.message || this.t('profile.avatar.uploadFailed', 'Unable to upload profile picture.'),
      });
    } finally {
      event.target.value = '';
    }
  };

  async prepareAvatarFile(file) {
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

  loadImage(file) {
    return new Promise((resolve, reject) => {
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

  getScaledDimensions(width, height, maxDimension) {
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

  canvasToFile(canvas, originalName, quality) {
    return new Promise((resolve, reject) => {
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

  replaceFileExtension(fileName, extension) {
    const normalizedName = fileName || 'avatar';
    const lastDotIndex = normalizedName.lastIndexOf('.');
    if (lastDotIndex === -1) {
      return `${normalizedName}.${extension}`;
    }

    return `${normalizedName.slice(0, lastDotIndex)}.${extension}`;
  }

  readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = typeof reader.result === 'string' ? reader.result : '';
        const base64Content = result.includes(',') ? result.split(',')[1] : result;
        resolve(base64Content);
      };
      reader.onerror = () => reject(reader.error || new Error(this.t('profile.avatar.readFailed', 'Unable to read file')));
      reader.readAsDataURL(file);
    });
  }

  renderAvatarControls() {
    if (!this.isEditableProfile()) {
      return null;
    }

    return (
      <div className="mt-3">
        <Form.Control
          id="avatarUploadInput"
          type="file"
          accept="image/*"
          onChange={this.handleAvatarUpload}
          disabled={this.state.avatarUploadStatus === 'uploading'}
          className="d-none"
        />
        {this.state.avatarUploadMessage && (
          <div className={`${this.state.avatarUploadStatus === 'error' ? 'text-danger' : 'text-success'} small text-center`}>
            {this.state.avatarUploadMessage}
          </div>
        )}
      </div>
    );
  }

  handleAvatarDescriptionChange = (event) => {
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
      const response = await fetch(`/api/profile/profile/${this.state.profileId}/avatar/description`, {
        method: 'PUT',
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          description: this.state.avatarDescriptionDraft || null,
        }),
      });

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
      const response = await fetch(`/api/profile/profile/${this.state.profileId}/avatar`, {
        method: 'DELETE',
      });

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

  renderAvatarFallback() {
    const initials = `${(this.state.firstName || '').trim()[0] || ''}${(this.state.lastName || '').trim()[0] || ''}`.toUpperCase() || 'P';

    return (
      <div
        style={{
          width: '100%',
          aspectRatio: '1 / 1',
          minHeight: '12rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '3rem',
          fontWeight: 'bold',
          color: '#666',
          backgroundColor: '#f8f9fa'
        }}
      >
        {initials}
      </div>
    );
  }

  renderAvatarDescription() {
    const isOwner = this.isEditableProfile();
    const hasDescription = Boolean((this.state.avatarInfo || '').trim());
    if (!this.state.avatarVisible || (!isOwner && !hasDescription)) {
      return null;
    }

    if (isOwner) {
      return (
        <div className="p-2 border-top">
          <div className="position-relative d-flex align-items-center justify-content-center">
            <Form.Control
              type="text"
              placeholder={this.t('profile.avatar.description.placeholder', 'Add a description')}
              value={this.state.avatarDescriptionDraft || ''}
              onChange={this.handleAvatarDescriptionChange}
              onBlur={this.handleAvatarDescriptionBlur}
              className="border-0 px-4 bg-transparent text-center"
              size="sm"
              style={{ width: '100%' }}
            />
            {(this.state.avatarDescriptionStatus === 'saving' || this.state.avatarDescriptionStatus === 'saved' || this.state.avatarDescriptionStatus === 'error') && (
              <div
                className="position-absolute end-0 d-flex align-items-center pe-1"
                style={{ top: '50%', transform: 'translateY(-50%)' }}
              >
                {this.state.avatarDescriptionStatus === 'saving' && <FaHourglassHalf className="text-muted" title={this.t('profile.status.saving', 'Saving')} />}
                {this.state.avatarDescriptionStatus === 'saved' && <span className="text-success">&#10003;</span>}
                {this.state.avatarDescriptionStatus === 'error' && <FaTimes className="text-danger" title={this.t('profile.status.saveFailed', 'Save failed')} />}
              </div>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="p-2 border-top">
        <div className="text-muted small text-center">
          {this.state.avatarInfo}
        </div>
      </div>
    );
  }

  renderAvatarPanel() {
    return (
      <div
        style={{
          width: '100%',
          maxWidth: AVATAR_PANEL_WIDTH,
          border: '4px #eee groove',
          backgroundColor: '#fff',
        }}
      >
        {this.state.avatarVisible
          ? <ModalImage
              src={this.state.avatarImage}
              url={this.state.avatarUrl}
              alt={this.state.avatarInfo}
              description={this.state.avatarInfo}
              wrapperStyle={{ maxWidth: '100%' }}
            />
          : this.state.avatarLoaded
            ? this.renderAvatarFallback()
            : <div className="p-4 text-center"><Spinner /></div>}
        {this.renderAvatarDescription()}
      </div>
    );
  }

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
    const isErrorMessage = this.state.messageVariant === 'error';

    return (
      <Container>
        <Row>
          <Col sm={12}>
            <h2>{this.t('profile.create.title', 'Create your profile')}</h2>
            <p>{this.t('profile.create.subtitle', 'Your user profile does not exist yet. Complete the required fields to continue.')}</p>
          </Col>
        </Row>
        <Row>
          <Col sm={6}>
            <Form onSubmit={this.handleCreateProfile}>
              <Form.Group controlId="firstName" className="mb-3">
                <Form.Label>{this.t('profile.field.firstName', 'First name')} *</Form.Label>
                <Form.Control
                  name="firstName"
                  type="text"
                  required
                  value={this.state.firstName}
                  onChange={this.handleInputChange}
                />
              </Form.Group>
              <Form.Group controlId="lastName" className="mb-3">
                <Form.Label>{this.t('profile.field.lastName', 'Last name')} *</Form.Label>
                <Form.Control
                  name="lastName"
                  type="text"
                  required
                  value={this.state.lastName}
                  onChange={this.handleInputChange}
                />
              </Form.Group>
              <Form.Group controlId="nickName" className="mb-3">
                <Form.Label>{this.t('profile.field.nickName', 'Nick name')}</Form.Label>
                <Form.Control
                  name="nickName"
                  type="text"
                  value={this.state.nickName}
                  onChange={this.handleInputChange}
                />
              </Form.Group>
              <Form.Group controlId="profileEmail" className="mb-3">
                <Form.Label>{this.t('profile.field.email', 'Profile email')}</Form.Label>
                <Form.Control
                  name="profileEmail"
                  type="email"
                  value={this.state.profileEmail}
                  onChange={this.handleInputChange}
                />
              </Form.Group>
              <Form.Group controlId="location" className="mb-3">
                <Form.Label>{this.t('profile.field.location', 'Location')}</Form.Label>
                <Form.Control
                  name="location"
                  type="text"
                  value={this.state.location}
                  onChange={this.handleInputChange}
                />
              </Form.Group>
              <Form.Group controlId="alias" className="mb-3">
                <Form.Label>{this.t('profile.field.alias', 'Alias')}</Form.Label>
                <Form.Control
                  name="alias"
                  type="text"
                  value={this.state.alias}
                  onChange={this.handleInputChange}
                />
              </Form.Group>
              <div className="d-flex align-items-center gap-2">
                <button className="btn btn-secondary" type="submit">
                  {this.t('profile.create.submit', 'Create profile')}
                </button>
                {isErrorMessage && <FaTimes className="text-danger" title={this.t('profile.create.failedShort', 'Creation failed')} />}
              </div>
            </Form>
          </Col>
        </Row>
      </Container>
    );
  }

  renderClubProfileCreateForm() {
    return (
      <Modal
        show={this.state.clubProfileCreateVisible}
        onHide={() => this.setState({ clubProfileCreateVisible: false, clubProfileCreateError: false })}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>{this.t('profile.clubProfile.create.title', 'Create club profile')}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={this.handleCreateClubProfile}>
            <Form.Group controlId="clubFirstName" className="mb-3">
              <Form.Label>{this.t('profile.field.firstName', 'First name')} *</Form.Label>
              <Form.Control name="firstName" type="text" required />
            </Form.Group>
            <Form.Group controlId="clubLastName" className="mb-3">
              <Form.Label>{this.t('profile.field.lastName', 'Last name')} *</Form.Label>
              <Form.Control name="lastName" type="text" required />
            </Form.Group>
            <Form.Group controlId="clubNickName" className="mb-3">
              <Form.Label>{this.t('profile.field.nickName', 'Nick name')}</Form.Label>
              <Form.Control name="nickName" type="text" />
            </Form.Group>
            <Form.Group controlId="clubProfileEmail" className="mb-3">
              <Form.Label>{this.t('profile.field.email', 'Profile email')}</Form.Label>
              <Form.Control name="profileEmail" type="email" />
            </Form.Group>
            <Form.Group controlId="clubLocation" className="mb-3">
              <Form.Label>{this.t('profile.field.location', 'Location')}</Form.Label>
              <Form.Control name="location" type="text" />
            </Form.Group>
            <Form.Group controlId="clubAlias" className="mb-3">
              <Form.Label>{this.t('profile.field.alias', 'Alias')}</Form.Label>
              <Form.Control name="alias" type="text" />
            </Form.Group>
            <Form.Group controlId="clubPeriod" className="mb-3">
              <Form.Label>{this.t('profile.field.period', 'Period')} *</Form.Label>
              <Form.Select name="period" required defaultValue="">
                <option value="">{this.t('profile.period.choose', 'Choose a period')}</option>
                {periods.map(period => (
                  <option key={period} value={period}>{this.getPeriodLabel(period)}</option>
                ))}
              </Form.Select>
            </Form.Group>
            <div className="d-flex align-items-center justify-content-end gap-2">
              {this.state.clubProfileCreateError && <FaTimes className="text-danger" title={this.t('profile.create.failedShort', 'Creation failed')} />}
              <Button variant="secondary" type="submit">{this.t('profile.clubProfile.create.submit', 'Create club profile')}</Button>
            </div>
          </Form>
        </Modal.Body>
      </Modal>
    );
  }

  renderDeleteClubProfileModal() {
    const clubProfile = this.state.clubProfileDeleteTarget;
    const clubProfileName = clubProfile
      ? `${clubProfile.firstName} ${clubProfile.lastName}`.trim()
      : '';

    return (
      <Modal
        show={Boolean(clubProfile)}
        onHide={this.closeDeleteClubProfileModal}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>{this.t('profile.clubProfile.delete.title', 'Delete club profile')}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="mb-2">
            {this.t('profile.clubProfile.delete.confirm', 'Delete {name}?', {
              name: clubProfileName || this.t('profile.clubProfile.delete.fallbackName', 'this club profile'),
            })}
          </p>
          {this.state.clubProfileDeleteError && (
            <div className="mt-3 d-flex align-items-center gap-2 text-danger">
              <FaTimes title={this.t('profile.clubProfile.delete.failedShort', 'Deletion failed')} />
              <span>{this.t('profile.clubProfile.delete.failed', 'Deletion failed.')}</span>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={this.closeDeleteClubProfileModal}>
            {this.t('profile.action.cancel', 'Cancel')}
          </Button>
          <Button variant="danger" onClick={this.handleDeleteClubProfile}>
            {this.t('profile.clubProfile.delete.submit', 'Delete club profile')}
          </Button>
        </Modal.Footer>
      </Modal>
    );
  }

  renderClubProfilesSection() {
    const isUserProfile = this.state.type === 'USER';
    const canCreate = this.isEditableProfile();
    const visibleClubProfiles = this.state.clubProfiles.filter(clubProfile => {
      if (clubProfile.id === this.state.profileId && this.state.type === 'CLUB') {
        return false;
      }

      return true;
    });
    const showEmptyMessage = isUserProfile && !visibleClubProfiles.length && !this.state.clubProfilesMessage;

    return (
      <>
        {isUserProfile && (
          <div className="d-flex align-items-center justify-content-between mb-3">
            <h4 className="mb-0">{this.t('profile.clubProfiles.title', 'Club profiles')}</h4>
            {canCreate && (
              <Button
                type="button"
                variant="light"
                className="p-0 d-inline-flex align-items-center justify-content-center text-decoration-none"
                onClick={() => this.setState({
                  clubProfileCreateVisible: true,
                  clubProfileCreateError: false,
                })}
                title={this.t('profile.clubProfile.create.title', 'Create club profile')}
                aria-label={this.t('profile.clubProfile.create.title', 'Create club profile')}
                style={{
                  width: '1.6rem',
                  height: '1.6rem',
                  border: '1px solid #000',
                  color: '#000',
                  lineHeight: 1,
                }}
              >
                <FaPlus />
              </Button>
            )}
          </div>
        )}
        {!this.state.clubProfilesLoaded && <Spinner />}
        {this.state.clubProfilesLoaded && this.state.clubProfilesMessage && (
          <div>{this.state.clubProfilesMessage}</div>
        )}
        {this.state.clubProfilesLoaded && showEmptyMessage && (
          <div>{this.t('profile.clubProfiles.empty', 'No club profiles yet.')}</div>
        )}
        {this.state.clubProfilesLoaded && visibleClubProfiles.length > 0 && (
          <div className="d-grid gap-2">
            {visibleClubProfiles.map(clubProfile => (
              <div key={clubProfile.id} className="d-flex gap-2">
                <Button
                  variant="outline-secondary"
                  className="text-start flex-grow-1"
                  onClick={() => this.handleOpenClubProfile(clubProfile)}
                >
                  {clubProfile.firstName} {clubProfile.lastName}{clubProfile.nickName ? ` ${clubProfile.nickName}` : ''}
                </Button>
              </div>
            ))}
          </div>
        )}
        {this.renderClubProfileCreateForm()}
      </>
    );
  }

  renderProfileFieldRow(label, fieldContent, readOnlyValue, status = null, editable = this.isEditableProfile()) {
    return (
      <div className="d-flex align-items-center gap-3 mb-2">
        <div className="text-start small fw-semibold" style={{ width: '7rem' }}>
          {label}
        </div>
        <div style={{ width: '100%', maxWidth: '16rem' }}>
          {editable ? (
            <div className="input-group input-group-sm">
              {fieldContent}
              {(status === 'saving' || status === 'saved' || status === 'error') && (
                <span className="input-group-text">
                  {status === 'saving' && <FaHourglassHalf className="text-muted" title={this.t('profile.status.saving', 'Saving')} />}
                  {status === 'saved' && <span className="text-success">&#10003;</span>}
                  {status === 'error' && <FaTimes className="text-danger" title={this.t('profile.status.saveFailed', 'Save failed')} />}
                </span>
              )}
            </div>
          ) : (
            <div className="small text-start px-1 py-1">{readOnlyValue}</div>
          )}
        </div>
      </div>
    );
  }

  renderProfileField(label, fieldName, options = {}) {
    const {
      type = 'text',
      required = false,
      editable = this.isEditableProfile(),
      readOnlyValue = this.state[fieldName] || '-',
      renderControl,
    } = options;

    const control = renderControl
      ? renderControl()
      : (
        <Form.Control
          name={fieldName}
          type={type}
          required={required}
          size="sm"
          value={this.state[fieldName] || ''}
          onChange={this.handleInputChange}
          onBlur={() => this.handleFieldBlur(fieldName)}
        />
      );

    return this.renderProfileFieldRow(label, control, readOnlyValue, this.state.fieldStatuses[fieldName], editable);
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
    const currentClubLabel = `${this.state.firstName} ${this.state.lastName}`.trim() || 'Club profile';

    return (
      <Container fluid className="px-4 px-xl-5">
        <Row>
          <Col sm={12} className="mb-3">
            <div
              className="p-3 rounded border"
              style={{
                backgroundColor: isClubProfile ? '#f8f4ea' : '#eef5ff',
                borderColor: isClubProfile ? '#d8c7a1' : '#bfd3f2'
              }}
            >
              <div className="d-flex align-items-center justify-content-between gap-3 flex-wrap">
                <div>
                  <div className="text-uppercase small fw-bold mb-1">
                    {headerSubtitleDisplay}
                  </div>
                </div>
                <div className="d-flex align-items-center gap-2 flex-wrap">
                  {isClubProfile && ownerLink && (
                    <div className="d-flex align-items-center gap-2 flex-wrap small">
                      <a href={ownerLink}>{ownerLabel}</a>
                      <span>{'>'}</span>
                      <a href={this.getCanonicalProfilePath({
                        id: this.state.profileId,
                        alias: this.state.alias,
                      })}>
                        {currentClubLabel}
                      </a>
                      <Dropdown align="end">
                        <Dropdown.Toggle
                          variant="link"
                          size="sm"
                          className="p-0 text-decoration-none"
                          style={{ color: '#000' }}
                          id="club-profile-switcher"
                        >
                        </Dropdown.Toggle>
                        <Dropdown.Menu>
                          {siblingClubProfiles.length ? siblingClubProfiles.map(clubProfile => (
                            <Dropdown.Item
                              key={clubProfile.id}
                              href={this.getCanonicalProfilePath(clubProfile)}
                            >
                              {`${clubProfile.firstName} ${clubProfile.lastName}`.trim()}
                            </Dropdown.Item>
                          )) : (
                            <Dropdown.Item disabled>{this.t('profile.clubProfiles.noneOther', 'No other club profiles')}</Dropdown.Item>
                          )}
                        </Dropdown.Menu>
                      </Dropdown>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Col>
        </Row>
        <Row className="g-4 align-items-start">
          <Col lg={3} md={4}>
            <div className="position-relative d-inline-block w-100" style={{ maxWidth: AVATAR_PANEL_WIDTH }}>
              {this.renderAvatarPanel()}
              {isEditable && (
                <button
                  type="button"
                  className="btn position-absolute top-0 start-0 m-2 d-flex align-items-center justify-content-center"
                  style={{
                    width: '1.75rem',
                    height: '1.75rem',
                    padding: 0,
                    border: '1px solid #ddd',
                    backgroundColor: 'rgba(255, 255, 255, 0.92)',
                    color: '#777',
                    fontSize: '0.8rem'
                  }}
                  onClick={this.openAvatarFilePicker}
                  title={this.t('profile.avatar.uploadTitle', 'Upload picture')}
                >
                  {this.state.avatarUploadStatus === 'uploading'
                    ? <FaHourglassHalf className="text-muted" />
                    : <FaUpload />}
                </button>
              )}
              {isEditable && this.state.avatarVisible && (
                <button
                  type="button"
                  className="btn position-absolute top-0 end-0 m-2 d-flex align-items-center justify-content-center"
                  style={{
                    width: '1.75rem',
                    height: '1.75rem',
                    padding: 0,
                    border: '1px solid #ddd',
                    backgroundColor: 'rgba(255, 255, 255, 0.92)',
                    color: '#777',
                    fontSize: '0.85rem'
                  }}
                  onClick={this.handleDeleteAvatar}
                  title={this.t('profile.avatar.deleteTitle', 'Delete picture')}
                >
                  <FaTrashAlt />
                </button>
              )}
            </div>
            {this.renderAvatarControls()}
          </Col>
          <Col lg={5} md={8}>
            <>
              {this.renderProfileField(this.t('profile.field.firstNameRequired', 'First name *'), 'firstName', { required: true, readOnlyValue: this.state.firstName })}
              {this.renderProfileField(this.t('profile.field.lastNameRequired', 'Last name *'), 'lastName', { required: true, readOnlyValue: this.state.lastName })}
              {this.renderProfileField(this.t('profile.field.nickName', 'Nick name'), 'nickName')}
              {this.renderProfileField(this.t('profile.field.email', 'Profile email'), 'profileEmail', { type: 'email' })}
              {this.renderProfileField(this.t('profile.field.location', 'Location'), 'location')}
              {this.renderProfileField(this.t('profile.field.alias', 'Alias'), 'alias')}
              {this.state.type === 'CLUB' && this.renderProfileField(this.t('profile.field.periodRequired', 'Period *'), 'period', {
                readOnlyValue: this.getPeriodLabel(this.state.period) || '-',
                renderControl: () => (
                  <Form.Select
                    size="sm"
                    name="period"
                    value={this.state.period}
                    onChange={this.handleInputChange}
                    onBlur={() => this.handleFieldBlur('period')}
                  >
                    <option value="">{this.t('profile.period.choose', 'Choose a period')}</option>
                    {periods.map(period => (
                      <option key={period} value={period}>{this.getPeriodLabel(period)}</option>
                    ))}
                  </Form.Select>
                ),
              })}
            </>
          </Col>
          <Col lg={4} md={12}>
            {isClubProfile && isEditable && (
              <div className="d-flex justify-content-end mb-3">
                <button
                  type="button"
                  className="btn d-flex align-items-center justify-content-center"
                  style={{
                    width: '1.9rem',
                    height: '1.9rem',
                    padding: 0,
                    border: '1px solid #ddd',
                    backgroundColor: 'rgba(255, 255, 255, 0.92)',
                    color: '#777',
                    fontSize: '0.9rem'
                  }}
                  onClick={() => this.openDeleteClubProfileModal({
                    id: this.state.profileId,
                    firstName: this.state.firstName,
                    lastName: this.state.lastName,
                    userId: this.state.userId,
                  })}
                  title={this.t('profile.clubProfile.delete.title', 'Delete club profile')}
                  aria-label={this.t('profile.clubProfile.delete.title', 'Delete club profile')}
                >
                  <FaTrashAlt />
                </button>
              </div>
            )}
            {this.renderClubProfilesSection()}
          </Col>
        </Row>
        {this.renderDeleteClubProfileModal()}
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

