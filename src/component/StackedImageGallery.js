import React, { useMemo, useState } from 'react';
import { Badge, Carousel, Image, Modal } from 'react-bootstrap';
import { FaTrashAlt, FaUpload } from 'react-icons/fa';

import EditableImageDescription from './EditableImageDescription';
import ImageOverlayActionButton from './ImageOverlayActionButton';
import IconActionButton from './IconActionButton';
import ImageDescriptionBlock from './ImageDescriptionBlock';

function getImageSrc(image) {
  return image?.url || `data:image/jpeg;base64, ${image?.src || ''}`;
}

export default function StackedImageGallery({
  images,
  title = 'Images',
  emptyText = 'No images yet.',
  editable = false,
  onDeleteImage,
  onReplaceImage,
  imageDrafts = {},
  imageStatuses = {},
  onDescriptionChange,
  onDescriptionBlur,
}) {
  const [show, setShow] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const previewImages = useMemo(() => (images || []).slice(0, 3), [images]);

  if (!images?.length) {
    return <div className="small text-muted">{emptyText}</div>;
  }

  return (
    <>
      <button
        type="button"
        className="btn p-0 border-0 bg-transparent text-start w-100"
        onClick={() => {
          setActiveIndex(0);
          setShow(true);
        }}
        style={{ cursor: 'pointer' }}
      >
        <div
          className="position-relative mx-auto"
          style={{
            width: 'min(100%, 22rem)',
            height: '18rem',
          }}
        >
          {previewImages.slice().reverse().map((image, index) => {
            const depth = previewImages.length - 1 - index;
            return (
              <div
                key={image.id || index}
                className="position-absolute top-0 start-0 rounded shadow-sm overflow-hidden border bg-white"
                style={{
                  width: '100%',
                  height: '100%',
                  transform: `translate(${depth * 16}px, ${depth * 14}px)`,
                  zIndex: index + 1,
                  borderColor: '#d8cbb4',
                }}
              >
                <Image
                  alt={image.fileName || title}
                  src={getImageSrc(image)}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: 'block',
                  }}
                />
              </div>
            );
          })}
          <div className="position-absolute bottom-0 start-0 m-2">
            <Badge bg="dark">{images.length} image(s)</Badge>
          </div>
        </div>
      </button>

      <Modal
        show={show}
        onHide={() => setShow(false)}
        centered
        size="xl"
      >
        <Modal.Header closeButton>
          <Modal.Title>{title}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <style>
            {`
              .stacked-image-gallery-carousel .carousel-indicators {
                bottom: 0.5rem;
                margin-bottom: 0;
              }
              .stacked-image-gallery-carousel .carousel-indicators [data-bs-target] {
                background-color: rgba(90, 74, 45, 0.55);
              }
              .stacked-image-gallery-carousel .carousel-control-prev-icon,
              .stacked-image-gallery-carousel .carousel-control-next-icon {
                border: 1px solid rgba(90, 74, 45, 0.72);
                border-radius: 999px;
                background-color: transparent;
                background-size: 60%;
                width: 2.6rem;
                height: 2.6rem;
                filter: drop-shadow(0 0 1px rgba(49, 35, 13, 0.95)) drop-shadow(0 0 4px rgba(255, 255, 255, 0.95));
              }
            `}
          </style>
          <Carousel
            className="stacked-image-gallery-carousel"
            activeIndex={activeIndex}
            onSelect={selectedIndex => setActiveIndex(selectedIndex)}
            interval={null}
            style={{
              border: '1px solid #d8cbb4',
              borderRadius: '0.75rem',
              overflow: 'hidden',
              backgroundColor: '#f7f4ee',
            }}
          >
            {images.map((image, index) => (
              <Carousel.Item key={image.id || index}>
                <div className="position-relative p-3 p-lg-4 pb-5">
                  {editable && onReplaceImage && (
                    <ImageOverlayActionButton
                      className="position-absolute top-0 start-0 m-3"
                      fontSize="0.9rem"
                      onClick={() => onReplaceImage(image)}
                      title="Replace image"
                      popover="Replace this picture with a new one. This does not edit the current image."
                    >
                      <FaUpload />
                    </ImageOverlayActionButton>
                  )}
                  {editable && onDeleteImage && (
                    <IconActionButton
                      className="position-absolute top-0 end-0 m-3"
                      fontSize="0.9rem"
                      onClick={() => onDeleteImage(image.id)}
                      title="Delete image"
                    >
                      <FaTrashAlt />
                    </IconActionButton>
                  )}
                  <Image
                    alt={image.fileName || `${title} ${index + 1}`}
                    src={getImageSrc(image)}
                    fluid
                    style={{
                      width: '100%',
                      maxHeight: '65vh',
                      objectFit: 'contain',
                      backgroundColor: '#f7f4ee',
                    }}
                  />
                  {editable ? (
                    <EditableImageDescription
                      editable
                      value={imageDrafts[image.id] ?? image.description ?? ''}
                      status={imageStatuses[image.id]}
                      className="mt-3 px-5"
                      bordered={false}
                      placeholder="Image description"
                      onChange={event => onDescriptionChange?.(image.id, event.target.value)}
                      onBlur={() => onDescriptionBlur?.(image.id)}
                      savingTitle="Saving"
                      errorTitle="Save failed"
                    />
                  ) : (
                    <ImageDescriptionBlock
                      description={image.description}
                      emptyText="No description"
                      className="mt-3 px-5"
                    />
                  )}
                </div>
              </Carousel.Item>
            ))}
          </Carousel>
        </Modal.Body>
      </Modal>
    </>
  );
}
