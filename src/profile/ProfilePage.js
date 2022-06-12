import React, { Component } from 'react';

import { Container, Row, Col } from 'react-bootstrap'

import { doFetch } from "../util/Fetcher.js";
import ModalImage from "../component/ModalImage";
import Spinner from "../component/Spinner";

class ProfilePage extends Component {
  constructor() {
    super();
    this.state = {avatarVisible: false};
  }

  componentDidMount() {
    this.fetchProfile(this.props.id);
  }

  fetchAvatar(profileId) {
    const url = `/api/image/image/profile/${profileId}`;
    const actions = {
      200: avatars => this.renderAvatar(avatars[0])
    };

    doFetch(url, "GET", null, actions);
  }

  fetchProfile(id) {
    const url = `/api/profile/profile/${id || ''}`;
    const actions = {
      200: profile => this.renderProfile(profile)
    };

    doFetch(url, "GET", null, actions);
  }

  renderProfile(profile) {
    this.setState({
      firstName: profile.firstName,
      lastName: profile.lastName
    });
    window.history.pushState(null, null, `/profile/${profile.id}`);
    this.fetchAvatar(profile.id)
  }

  renderAvatar(avatar) {
    this.setState({
      avatarVisible: true,
      avatarImage: avatar.content,
      avatarInfo: avatar.imageInfo
    });
  }

  render() {
    return (
      <Container>
        <Row>
          <Col sm={4}>
            {this.state.avatarVisible ? <ModalImage src={this.state.avatarImage} alt={this.state.avatarInfo} /> : <Spinner />}
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
}

export default ProfilePage;
