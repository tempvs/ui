import React, { useState } from 'react';
import { Modal, Image }  from 'react-bootstrap';
import ImageDescriptionBlock from './ImageDescriptionBlock';

function ModalImage(props) {
  const [show, setShow] = useState(false);
  const imageSrc = props.url || `data:image/jpeg;base64, ${props.src}`;
  const wrapperStyle = {
    width: '100%',
    maxWidth: '18rem',
    ...props.wrapperStyle,
  };
  const imageStyle = {
    width: '100%',
    display: 'block',
    cursor: 'pointer',
    ...props.imageStyle,
  };

  return (
    <>
      <div style={wrapperStyle}>
        <Image alt={props.alt} src={imageSrc} onClick={() => setShow(true)} style={imageStyle} />
      </div>

      <Modal show={show} onHide={() => setShow(false)} centered size={props.modalSize}>
        <Modal.Body>
          <div className="position-relative">
            {props.modalTopLeftAction ? (
              <div className="position-absolute top-0 start-0 m-3" style={{ zIndex: 4 }}>
                {props.modalTopLeftAction}
              </div>
            ) : null}
            {props.modalTopRightAction ? (
              <div className="position-absolute top-0 end-0 m-3" style={{ zIndex: 4 }}>
                {props.modalTopRightAction}
              </div>
            ) : null}
            <Image alt={props.alt} src={imageSrc} fluid />
          </div>
          {props.modalDescriptionContent || (
            <ImageDescriptionBlock description={props.description} className="mt-3" />
          )}
        </Modal.Body>
      </Modal>
    </>
  );
}

export default ModalImage;
