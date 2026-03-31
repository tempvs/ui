import React, { Component } from 'react';

import { Container, Form, Row, Col, Button, Dropdown, Modal } from 'react-bootstrap';
import { FaHourglassHalf, FaTimes, FaTrashAlt, FaUpload } from 'react-icons/fa';

import { doFetch } from "../util/Fetcher.js";
import InlineEditableField from "../component/InlineEditableField";
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
        clubProfilesMessage: 'Unable to load club profiles.',
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
        message: this.extractCreateErrorMessage(error, 'Unable to create profile. Check the required fields.'),
        messageVariant: 'error',
      }),
      401: () => this.setState({
        message: 'You need to sign in before creating a profile.',
        messageVariant: 'error',
      }),
      409: () => this.setState({
        message: 'User profile already exists.',
        messageVariant: 'error',
      }),
      default: error => this.setState({
        message: this.extractCreateErrorMessage(error, 'Unable to create profile right now.'),
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
      const content = await this.readFileAsBase64(file);
      const response = await fetch(`/api/profile/profile/${this.state.profileId}/avatar`, {
        method: 'POST',
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          content,
          fileName: file.name,
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
        avatarUploadMessage: 'Unable to upload profile picture.',
      });
    } finally {
      event.target.value = '';
    }
  };

  readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = typeof reader.result === 'string' ? reader.result : '';
        const base64Content = result.includes(',') ? result.split(',')[1] : result;
        resolve(base64Content);
      };
      reader.onerror = () => reject(reader.error || new Error('Unable to read file'));
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
        avatarUploadMessage: 'Unable to delete profile picture.',
        avatarUploadStatus: 'error',
      });
    }
  };

  renderAvatarFallback() {
    const initials = `${(this.state.firstName || '').trim()[0] || ''}${(this.state.lastName || '').trim()[0] || ''}`.toUpperCase() || 'P';

    return (
      <div
        style={{
          width: '30vw',
          minHeight: '12rem',
          border: '4px #eee groove',
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
    if (!this.state.avatarVisible) {
      return null;
    }

    const status = this.state.avatarDescriptionStatus;
    return (
      <InlineEditableField
        editable={this.isEditableProfile()}
        controlId="avatarDescription"
        status={status}
        className="mt-2"
        inputGroupClassName="mx-auto"
        readOnlyClassName="text-muted small text-center mx-auto"
        readOnlyValue={this.state.avatarInfo || 'No picture description.'}
        renderControl={() => (
          <Form.Control
            type="text"
            placeholder="Add a description"
            value={this.state.avatarDescriptionDraft || ''}
            onChange={this.handleAvatarDescriptionChange}
            onBlur={this.handleAvatarDescriptionBlur}
            className="text-center"
            style={{ maxWidth: '30vw', minWidth: '12rem' }}
          />
        )}
        renderReadOnly={() => (
          <div className="text-muted small text-center mx-auto" style={{ maxWidth: '30vw', minWidth: '12rem' }}>
            {this.state.avatarInfo || 'No picture description.'}
          </div>
        )}
      />
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
            <h2>Create your profile</h2>
            <p>Your user profile does not exist yet. Complete the required fields to continue.</p>
          </Col>
        </Row>
        <Row>
          <Col sm={6}>
            <Form onSubmit={this.handleCreateProfile}>
              <Form.Group controlId="firstName" className="mb-3">
                <Form.Label>First name *</Form.Label>
                <Form.Control
                  name="firstName"
                  type="text"
                  required
                  value={this.state.firstName}
                  onChange={this.handleInputChange}
                />
              </Form.Group>
              <Form.Group controlId="lastName" className="mb-3">
                <Form.Label>Last name *</Form.Label>
                <Form.Control
                  name="lastName"
                  type="text"
                  required
                  value={this.state.lastName}
                  onChange={this.handleInputChange}
                />
              </Form.Group>
              <Form.Group controlId="nickName" className="mb-3">
                <Form.Label>Nick name</Form.Label>
                <Form.Control
                  name="nickName"
                  type="text"
                  value={this.state.nickName}
                  onChange={this.handleInputChange}
                />
              </Form.Group>
              <Form.Group controlId="profileEmail" className="mb-3">
                <Form.Label>Profile email</Form.Label>
                <Form.Control
                  name="profileEmail"
                  type="email"
                  value={this.state.profileEmail}
                  onChange={this.handleInputChange}
                />
              </Form.Group>
              <Form.Group controlId="location" className="mb-3">
                <Form.Label>Location</Form.Label>
                <Form.Control
                  name="location"
                  type="text"
                  value={this.state.location}
                  onChange={this.handleInputChange}
                />
              </Form.Group>
              <Form.Group controlId="alias" className="mb-3">
                <Form.Label>Alias</Form.Label>
                <Form.Control
                  name="alias"
                  type="text"
                  value={this.state.alias}
                  onChange={this.handleInputChange}
                />
              </Form.Group>
              <div className="d-flex align-items-center gap-2">
                <button className="btn btn-secondary" type="submit">
                  Create profile
                </button>
                {isErrorMessage && <FaTimes className="text-danger" title="Creation failed" />}
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
          <Modal.Title>Create club profile</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={this.handleCreateClubProfile}>
            <Form.Group controlId="clubFirstName" className="mb-3">
              <Form.Label>First name *</Form.Label>
              <Form.Control name="firstName" type="text" required />
            </Form.Group>
            <Form.Group controlId="clubLastName" className="mb-3">
              <Form.Label>Last name *</Form.Label>
              <Form.Control name="lastName" type="text" required />
            </Form.Group>
            <Form.Group controlId="clubNickName" className="mb-3">
              <Form.Label>Nick name</Form.Label>
              <Form.Control name="nickName" type="text" />
            </Form.Group>
            <Form.Group controlId="clubProfileEmail" className="mb-3">
              <Form.Label>Profile email</Form.Label>
              <Form.Control name="profileEmail" type="email" />
            </Form.Group>
            <Form.Group controlId="clubLocation" className="mb-3">
              <Form.Label>Location</Form.Label>
              <Form.Control name="location" type="text" />
            </Form.Group>
            <Form.Group controlId="clubAlias" className="mb-3">
              <Form.Label>Alias</Form.Label>
              <Form.Control name="alias" type="text" />
            </Form.Group>
            <Form.Group controlId="clubPeriod" className="mb-3">
              <Form.Label>Period *</Form.Label>
              <Form.Select name="period" required defaultValue="">
                <option value="">Choose a period</option>
                {periods.map(period => (
                  <option key={period} value={period}>{period}</option>
                ))}
              </Form.Select>
            </Form.Group>
            <div className="d-flex align-items-center justify-content-end gap-2">
              {this.state.clubProfileCreateError && <FaTimes className="text-danger" title="Creation failed" />}
              <Button variant="secondary" type="submit">Create club profile</Button>
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
          <Modal.Title>Delete club profile</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="mb-2">
            Delete <strong>{clubProfileName || 'this club profile'}</strong>?
          </p>
          {this.state.clubProfileDeleteError && (
            <div className="mt-3 d-flex align-items-center gap-2 text-danger">
              <FaTimes title="Deletion failed" />
              <span>Deletion failed.</span>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={this.closeDeleteClubProfileModal}>
            Cancel
          </Button>
          <Button variant="danger" onClick={this.handleDeleteClubProfile}>
            Delete club profile
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
        {!isUserProfile && this.state.ownerUserProfileLoaded && this.state.ownerUserProfile && (
          <div className="mb-3">
            <a href={this.getCanonicalProfilePath(this.state.ownerUserProfile)}>
              Back to user profile
            </a>
          </div>
        )}
        <h4>Club profiles</h4>
        {!this.state.clubProfilesLoaded && <Spinner />}
        {this.state.clubProfilesLoaded && this.state.clubProfilesMessage && (
          <div>{this.state.clubProfilesMessage}</div>
        )}
        {this.state.clubProfilesLoaded && showEmptyMessage && (
          <div>No club profiles yet.</div>
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
        {canCreate && (
          <>
            <Button
              variant="secondary"
              className="mt-3"
              onClick={() => this.setState({
                clubProfileCreateVisible: true,
                clubProfileCreateError: false,
              })}
            >
              Create club profile
            </Button>
            {this.renderClubProfileCreateForm()}
          </>
        )}
      </>
    );
  }

  renderProfileField(label, fieldName, options = {}) {
    const {
      type = 'text',
      required = false,
      editable = this.isEditableProfile(),
      readOnlyValue = this.state[fieldName] || '-',
      renderControl,
      renderReadOnly,
    } = options;

    return (
      <InlineEditableField
        editable={editable}
        label={label}
        controlId={fieldName}
        status={this.state.fieldStatuses[fieldName]}
        className="mb-3"
        readOnlyClassName="small"
        readOnlyValue={readOnlyValue}
        renderReadOnly={renderReadOnly}
        renderControl={renderControl || (() => (
          <Form.Control
            name={fieldName}
            type={type}
            required={required}
            value={this.state[fieldName] || ''}
            onChange={this.handleInputChange}
            onBlur={() => this.handleFieldBlur(fieldName)}
          />
        ))}
      />
    );
  }

  renderProfileView() {
    const isEditable = this.isEditableProfile();
    const isClubProfile = this.state.type === 'CLUB';
    const headerSubtitle = isClubProfile
      ? `Club profile${this.state.period ? ` • ${this.state.period.replaceAll('_', ' ')}` : ''}`
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
      <Container>
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
                    {headerSubtitle}
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
                            <Dropdown.Item disabled>No other club profiles</Dropdown.Item>
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
        <Row>
          <Col sm={4}>
            <div className="position-relative d-inline-block">
              {this.state.avatarVisible
                ? <ModalImage src={this.state.avatarImage} url={this.state.avatarUrl} alt={this.state.avatarInfo} />
                : this.state.avatarLoaded
                  ? this.renderAvatarFallback()
                  : <Spinner />}
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
                  title="Upload picture"
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
                  title="Delete picture"
                >
                  <FaTrashAlt />
                </button>
              )}
            </div>
            {this.renderAvatarDescription()}
            {this.renderAvatarControls()}
          </Col>
          <Col sm={4}>
            <>
              {this.renderProfileField('First name *', 'firstName', { required: true, readOnlyValue: this.state.firstName })}
              {this.renderProfileField('Last name *', 'lastName', { required: true, readOnlyValue: this.state.lastName })}
              {this.renderProfileField('Nick name', 'nickName')}
              {this.renderProfileField('Profile email', 'profileEmail', { type: 'email' })}
              {this.renderProfileField('Location', 'location')}
              {this.renderProfileField('Alias', 'alias')}
              {this.state.type === 'CLUB' && this.renderProfileField('Period *', 'period', {
                readOnlyValue: this.state.period || '-',
                renderControl: () => (
                  <Form.Select
                    name="period"
                    value={this.state.period}
                    onChange={this.handleInputChange}
                    onBlur={() => this.handleFieldBlur('period')}
                  >
                    <option value="">Choose a period</option>
                    {periods.map(period => (
                      <option key={period} value={period}>{period}</option>
                    ))}
                  </Form.Select>
                ),
              })}
            </>
          </Col>
          <Col sm={4}>
            {this.renderClubProfilesSection()}
          </Col>
        </Row>
        {isClubProfile && isEditable && (
          <Row className="mt-3">
            <Col sm={12} className="d-flex justify-content-end">
              <Button
                variant="outline-danger"
                onClick={() => this.openDeleteClubProfileModal({
                  id: this.state.profileId,
                  firstName: this.state.firstName,
                  lastName: this.state.lastName,
                  userId: this.state.userId,
                })}
              >
                Delete club profile
              </Button>
            </Col>
          </Row>
        )}
        {this.renderDeleteClubProfileModal()}
      </Container>
    );
  }

  renderNotFound() {
    return (
      <Container>
        <Row>
          <Col sm={12}>
            Profile not found.
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

export default ProfilePage;
