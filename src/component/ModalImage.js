import React, { Component } from 'react';

import { Modal, Image }  from 'react-bootstrap';

class ModalImage extends Component {
  constructor() {
    super();
    this.state = {show: false};

    this.handleShow = this.handleShow.bind(this);
    this.handleClose = this.handleClose.bind(this);
  }

  handleShow() {
    this.setState({show: true});
  }

  handleClose() {
    this.setState({show: false});
  }

  render() {
    return (
      <>
        <div style={{width: '30vw', border: '4px #eee groove'}}>
          <Image alt={this.props.alt} src={`data:image/jpeg;base64, ${this.props.src}`} onClick={this.handleShow} />
        </div>

        <Modal show={this.state.show} onHide={this.handleClose}>
          <Modal.Body>
            <Image alt={this.props.alt} src={`data:image/jpeg;base64, ${this.props.src}`} />
          </Modal.Body>
        </Modal>
      </>
    );
  }
}

export default ModalImage;
