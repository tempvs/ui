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
    const imageSrc = this.props.url || `data:image/jpeg;base64, ${this.props.src}`;
    const wrapperStyle = {
      width: '100%',
      maxWidth: '18rem',
      ...this.props.wrapperStyle,
    };
    const imageStyle = {
      width: '100%',
      display: 'block',
      cursor: 'pointer',
      ...this.props.imageStyle,
    };

    return (
      <>
        <div style={wrapperStyle}>
          <Image alt={this.props.alt} src={imageSrc} onClick={this.handleShow} style={imageStyle} />
        </div>

        <Modal show={this.state.show} onHide={this.handleClose} centered>
          <Modal.Body>
            <Image alt={this.props.alt} src={imageSrc} fluid />
            {this.props.description && (
              <div className="text-muted small text-center mt-3">
                {this.props.description}
              </div>
            )}
          </Modal.Body>
        </Modal>
      </>
    );
  }
}

export default ModalImage;
