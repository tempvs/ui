import React, { Component } from 'react';

import { Container, Form, Row, Col, InputGroup } from 'react-bootstrap';
import { FaCheck, FaHourglassHalf } from 'react-icons/fa';

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

  async saveField(fieldName) {
    if (!this.isEditableProfile()) {
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
        this.statusResetTimers[fieldName] = setTimeout(() => {
          this.setState(prevState => ({
            fieldStatuses: {
              ...prevState.fieldStatuses,
              [fieldName]: null,
            },
          }));
          delete this.statusResetTimers[fieldName];
        }, 1000);
        return;
      }

      this.setState(prevState => ({
        fieldStatuses: {
          ...prevState.fieldStatuses,
          [fieldName]: 'error',
        },
      }));
    } catch (error) {
      this.setState(prevState => ({
        fieldStatuses: {
          ...prevState.fieldStatuses,
          [fieldName]: 'error',
        },
      }));
    }
  }

  handleCreateProfile = (event) => {
    event.preventDefault();
    this.setState({ message: null });

    doFetch('/api/profile/user-profile', 'POST', event, {
      200: profile => this.renderProfile(profile),
      400: () => this.setState({ message: 'Unable to create profile. Check the required fields.' }),
      401: () => this.setState({ message: 'You need to sign in before creating a profile.' }),
      409: () => this.setState({ message: 'User profile already exists.' }),
      default: () => this.setState({ message: 'Unable to create profile right now.' }),
    });
  };

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
      fieldStatuses: savedField
        ? {
            ...prevState.fieldStatuses,
            [savedField]: 'saved',
          }
        : prevState.fieldStatuses,
    }));

    if (window.location.pathname !== `/profile/${profile.id}`) {
      window.history.replaceState(null, '', `/profile/${profile.id}`);
    }

    if (refreshAvatar) {
      this.setState({ avatarVisible: false, avatarLoaded: false });
      this.fetchAvatar(profile.id);
    }
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
              {this.state.message && <div className="mb-3">{this.state.message}</div>}
              <button className="btn btn-secondary" type="submit">
                Create profile
              </button>
            </Form>
          </Col>
        </Row>
      </Container>
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
          {(status === 'saving' || status === 'saved') && (
            <InputGroup.Text>
              {status === 'saving' && <FaHourglassHalf className="text-muted" title="Saving" />}
              {status === 'saved' && <FaCheck className="text-success" title="Saved" />}
            </InputGroup.Text>
          )}
        </InputGroup>
        {status === 'error' && <div className="mt-1 text-danger">Save failed</div>}
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
          {(status === 'saving' || status === 'saved') && (
            <InputGroup.Text>
              {status === 'saving' && <FaHourglassHalf className="text-muted" title="Saving" />}
              {status === 'saved' && <FaCheck className="text-success" title="Saved" />}
            </InputGroup.Text>
          )}
        </InputGroup>
        {status === 'error' && <div className="mt-1 text-danger">Save failed</div>}
      </Form.Group>
    );
  }

  renderProfileView() {
    const isEditable = this.isEditableProfile();

    return (
      <Container>
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
            Club profiles: <br/>
            TBD
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
