import React, { Component } from 'react';

import { Container, Form, Row, Col, InputGroup, Button, Dropdown } from 'react-bootstrap';
import { FaCheck, FaHourglassHalf, FaTimes } from 'react-icons/fa';

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

    if (!this.props.id) {
      return true;
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
      this.setState(prevState => ({
        fieldStatuses: {
          ...prevState.fieldStatuses,
          [fieldName]: null,
        },
      }));
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

  handleDeleteClubProfile = async (clubProfile) => {
    if (!window.confirm(`Delete ${clubProfile.firstName} ${clubProfile.lastName}?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/profile/profile/${clubProfile.id}`, {
        method: 'DELETE',
      });

      if (response.status !== 200) {
        return;
      }

      const deletingCurrentProfile = this.state.profileId === clubProfile.id;
      const ownerProfile = this.state.ownerUserProfile;

      this.setState(prevState => ({
        clubProfiles: prevState.clubProfiles.filter(profile => profile.id !== clubProfile.id),
      }));

      if (deletingCurrentProfile && ownerProfile) {
        this.renderProfile(ownerProfile);
        return;
      }

      this.fetchClubProfiles(clubProfile.userId);
    } catch (error) {
      // Keep the UI unchanged on failed delete; this path should become explicit only if needed.
    }
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
      avatarInfo: avatar.imageInfo
    });
  }

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
    if (!this.state.clubProfileCreateVisible) {
      return null;
    }

    return (
      <Form onSubmit={this.handleCreateClubProfile} className="mt-3">
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
        <div className="d-flex align-items-center gap-2">
          <Button variant="secondary" type="submit">Create club profile</Button>
          {this.state.clubProfileCreateError && <FaTimes className="text-danger" title="Creation failed" />}
        </div>
      </Form>
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
              variant={this.state.clubProfileCreateVisible ? 'outline-secondary' : 'secondary'}
              className="mt-3"
              onClick={() => this.setState(prevState => ({
                clubProfileCreateVisible: !prevState.clubProfileCreateVisible,
                clubProfileCreateError: false,
              }))}
            >
              {this.state.clubProfileCreateVisible ? 'Cancel club profile' : 'Create club profile'}
            </Button>
            {this.renderClubProfileCreateForm()}
          </>
        )}
      </>
    );
  }

  renderEditableField(label, fieldName, type = 'text', required = false) {
    const status = this.state.fieldStatuses[fieldName];

    return (
      <Form.Group controlId={fieldName} className="mb-3">
        <Form.Label>{label}</Form.Label>
        <InputGroup>
          <Form.Control
            name={fieldName}
            type={type}
            required={required}
            value={this.state[fieldName] || ''}
            onChange={this.handleInputChange}
            onBlur={() => this.handleFieldBlur(fieldName)}
          />
          {(status === 'saving' || status === 'saved' || status === 'error') && (
            <InputGroup.Text>
              {status === 'saving' && <FaHourglassHalf className="text-muted" title="Saving" />}
              {status === 'saved' && <FaCheck className="text-success" title="Saved" />}
              {status === 'error' && <FaTimes className="text-danger" title="Save failed" />}
            </InputGroup.Text>
          )}
        </InputGroup>
      </Form.Group>
    );
  }

  renderEditablePeriodField() {
    const status = this.state.fieldStatuses.period;

    return (
      <Form.Group controlId="period" className="mb-3">
        <Form.Label>Period *</Form.Label>
        <InputGroup>
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
          {(status === 'saving' || status === 'saved' || status === 'error') && (
            <InputGroup.Text>
              {status === 'saving' && <FaHourglassHalf className="text-muted" title="Saving" />}
              {status === 'saved' && <FaCheck className="text-success" title="Saved" />}
              {status === 'error' && <FaTimes className="text-danger" title="Save failed" />}
            </InputGroup.Text>
          )}
        </InputGroup>
      </Form.Group>
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
            {this.state.avatarVisible
              ? <ModalImage src={this.state.avatarImage} alt={this.state.avatarInfo} />
              : this.state.avatarLoaded
                ? this.renderAvatarFallback()
                : <Spinner />}
          </Col>
          <Col sm={4}>
            {isEditable ? (
              <>
                {this.renderEditableField('First name *', 'firstName', 'text', true)}
                {this.renderEditableField('Last name *', 'lastName', 'text', true)}
                {this.renderEditableField('Nick name', 'nickName')}
                {this.renderEditableField('Profile email', 'profileEmail', 'email')}
                {this.renderEditableField('Location', 'location')}
                {this.renderEditableField('Alias', 'alias')}
                {this.state.type === 'CLUB' && this.renderEditablePeriodField()}
              </>
            ) : (
              <>
                First name: {this.state.firstName} <br/>
                Last name: {this.state.lastName} <br/>
                Nick name: {this.state.nickName || '-'} <br/>
                Profile email: {this.state.profileEmail || '-'} <br/>
                Location: {this.state.location || '-'} <br/>
                Alias: {this.state.alias || '-'} <br/>
                {this.state.type === 'CLUB' && <>Period: {this.state.period || '-'} <br/></>}
              </>
            )}
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
                onClick={() => this.handleDeleteClubProfile({
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
