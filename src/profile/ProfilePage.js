import React, { Component } from 'react';

import { Button, Container, Form, Row, Col } from 'react-bootstrap';

import { doFetch } from "../util/Fetcher.js";
import ModalImage from "../component/ModalImage";
import Spinner from "../component/Spinner";

class ProfilePage extends Component {
  constructor() {
    super();
    this.state = {
      avatarVisible: false,
      avatarLoaded: false,
      loaded: false,
      notFound: false,
      createMode: false,
      firstName: '',
      lastName: '',
      message: null,
    };
  }

  componentDidMount() {
    this.fetchProfile(this.props.id);
  }

  componentDidUpdate(prevProps) {
    if (prevProps.id !== this.props.id) {
      this.resetState();
      this.fetchProfile(this.props.id);
    }
  }

  resetState() {
    this.setState({
      avatarVisible: false,
      avatarLoaded: false,
      loaded: false,
      notFound: false,
      createMode: false,
      firstName: '',
      lastName: '',
      message: null,
    });
  }

  fetchAvatar(profileId) {
    const url = `/api/image/image/profile/${profileId}`;
    const actions = {
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
    };

    doFetch(url, "GET", null, actions);
  }

  fetchProfile(id) {
    const url = id ? `/api/profile/profile/${id}` : '/api/profile/profile';
    const actions = {
      200: profile => this.renderProfile(profile),
      404: () => this.handleMissingProfile(id),
    };

    doFetch(url, "GET", null, actions);
  }

  handleMissingProfile(id) {
    if (id) {
      this.setState({ loaded: true, notFound: true, createMode: false });
      return;
    }

    this.setState({ loaded: true, notFound: true, createMode: true });
    this.prefillProfileFromOAuth();
  }

  prefillProfileFromOAuth() {
    doFetch("/api/user/oauth/me", "GET", null, {
      200: profile => {
        const { firstName, lastName } = this.splitName(profile?.name, profile?.email);
        this.setState({
          firstName: this.state.firstName || firstName,
          lastName: this.state.lastName || lastName,
        });
      },
      401: () => {},
      404: () => {},
      default: () => {},
    });
  }

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

  handleInputChange = (event) => {
    const { name, value } = event.target;
    this.setState({ [name]: value });
  };

  handleCreateProfile = (event) => {
    event.preventDefault();
    this.setState({ message: null });

    const actions = {
      200: profile => this.renderProfile(profile),
      400: () => this.setState({ message: 'Unable to create profile. Check the required fields.' }),
      401: () => this.setState({ message: 'You need to sign in before creating a profile.' }),
      409: () => this.setState({ message: 'User profile already exists.' }),
      default: () => this.setState({ message: 'Unable to create profile right now.' }),
    };

    doFetch('/api/profile/user-profile', 'POST', event, actions);
  };

  renderProfile(profile) {
    this.setState({
      loaded: true,
      notFound: false,
      createMode: false,
      avatarVisible: false,
      avatarLoaded: false,
      firstName: profile.firstName,
      lastName: profile.lastName
    });
    window.history.pushState(null, null, `/profile/${profile.id}`);
    this.fetchAvatar(profile.id);
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
              <Button variant="secondary" type="submit">
                Create profile
              </Button>
            </Form>
          </Col>
        </Row>
      </Container>
    );
  }

  renderProfileView() {
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
            First name: {this.state.firstName} <br/>
            Last name: {this.state.lastName} <br/>
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
