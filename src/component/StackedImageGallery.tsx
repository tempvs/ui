import React, { useMemo, useState } from 'react';
import { Badge, Carousel, Modal } from 'react-bootstrap';
import { FaUpload } from 'react-icons/fa';

import ConfirmingTrashButton from './ConfirmingTrashButton';
import EditableImageDescription from './EditableImageDescription';
import ImageOverlayActionButton from './ImageOverlayActionButton';
import ImageDescriptionBlock from './ImageDescriptionBlock';
import { SaveStatus } from './EditableFieldRow';
import RefreshingImage from '../image/RefreshingImage';

export type GalleryImage = {
  id: string | number;
  url?: string | null;
  thumbnailUrl?: string | null;
  resourceType?: string | null;
  resourceId?: string | number | null;
  belongsTo?: string | null;
  entityId?: string | number | null;
  fileName?: string | null;
  description?: string | null;
};

type StackedImageGalleryProps = {
  images?: GalleryImage[];
  title?: string;
  emptyText?: string;
  previewSize?: 'default' | 'compact' | 'inventory';
  mode?: 'single' | 'multiple';
  editable?: boolean;
  onDeleteImage?: (imageId: GalleryImage['id']) => void;
  onReplaceImage?: (image: GalleryImage) => void;
  imageDrafts?: Record<string | number, string | undefined>;
  imageStatuses?: Record<string | number, SaveStatus>;
  onDescriptionChange?: (imageId: GalleryImage['id'], value: string) => void;
  onDescriptionBlur?: (imageId: GalleryImage['id']) => void;
  replaceTitle?: string;
  replacePopover?: string;
  deleteTitle?: string;
  deleteConfirmTitle?: string;
  deleteConfirmMessage?: string;
  deleteLabel?: string;
  cancelLabel?: string;
  wrapperClassName?: string;
  imageClassName?: string;
  previewStyle?: React.CSSProperties;
  modalSize?: 'sm' | 'lg' | 'xl';
  showInlineDescription?: boolean;
};

const UploadIcon = FaUpload as React.ComponentType<{ className?: string }>;

export default function StackedImageGallery({
  images,
  title = 'Images',
  emptyText = 'No images yet.',
  previewSize = 'default',
  mode = 'multiple',
  editable = false,
  onDeleteImage,
  onReplaceImage,
  imageDrafts = {},
  imageStatuses = {},
  onDescriptionChange,
  onDescriptionBlur,
  replaceTitle = 'Replace image',
  replacePopover = 'Replace this picture with a new one.',
  deleteTitle = 'Delete image',
  deleteConfirmTitle = 'Delete image',
  deleteConfirmMessage = 'Delete this image?',
  deleteLabel,
  cancelLabel,
  wrapperClassName = '',
  imageClassName,
  previewStyle,
  modalSize = 'xl',
  showInlineDescription = false,
}: StackedImageGalleryProps) {
  const [show, setShow] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const isSingle = mode === 'single';
  const displayImages = useMemo(
    () => (isSingle ? (images || []).slice(0, 1) : (images || [])),
    [images, isSingle],
  );
  const previewImages = useMemo(() => displayImages.slice(0, 3), [displayImages]);
  const isCompact = previewSize === 'compact';
  const isInventory = previewSize === 'inventory';
  const activeImage = displayImages[activeIndex] || displayImages[0];

  if (!displayImages.length) {
    return <div className="small text-muted">{emptyText}</div>;
  }

  const descriptionContent = (image: GalleryImage, className = '') => (
    editable ? (
      <EditableImageDescription
        editable
        value={imageDrafts[image.id] ?? image.description ?? ''}
        status={imageStatuses[image.id]}
        className={className}
        bordered={false}
        placeholder="Image description"
        onChange={event => onDescriptionChange?.(image.id, event.target.value)}
        onBlur={() => onDescriptionBlur?.(image.id)}
        savingTitle="Saving"
        errorTitle="Save failed"
      />
    ) : (
      <ImageDescriptionBlock description={image.description} emptyText="No description" className={className} />
    )
  );

  const imageActions = (image: GalleryImage, className = '') => (
    <>
      {editable && onReplaceImage && (
        <ImageOverlayActionButton
          className={`position-absolute top-0 start-0 m-3 ${className}`.trim()}
          fontSize="0.9rem"
          onClick={event => {
            event.stopPropagation();
            onReplaceImage(image);
          }}
          title={replaceTitle}
          popover={replacePopover}
          style={{ zIndex: 4 }}
        >
          <UploadIcon />
        </ImageOverlayActionButton>
      )}
      {editable && onDeleteImage && (
        <ConfirmingTrashButton
          className={`position-absolute top-0 end-0 m-3 ${className}`.trim()}
          fontSize="0.9rem"
          title={deleteTitle}
          confirmTitle={deleteConfirmTitle}
          confirmMessage={deleteConfirmMessage}
          confirmLabel={deleteLabel}
          cancelLabel={cancelLabel}
          onConfirm={() => onDeleteImage(image.id)}
          style={{ zIndex: 4 }}
        />
      )}
    </>
  );

  return (
    <>
      {isSingle && activeImage ? (
        <div className={`position-relative ${wrapperClassName}`.trim()}>
          <button
            type="button"
            className="btn p-0 border-0 bg-transparent text-start w-100"
            onClick={event => {
              event.stopPropagation();
              setShow(true);
            }}
            style={{ cursor: 'zoom-in' }}
          >
            <RefreshingImage
              image={activeImage}
              variant="display"
              alt={activeImage.fileName || title}
              className={imageClassName}
              style={{ width: '100%', display: 'block', ...previewStyle }}
            />
          </button>
          {imageActions(activeImage, 'm-2')}
          {showInlineDescription && descriptionContent(activeImage, 'mt-2')}
        </div>
      ) : (
        <button
          type="button"
          className={`btn p-0 border-0 bg-transparent text-start w-100 ${wrapperClassName}`.trim()}
          onClick={() => {
            setActiveIndex(0);
            setShow(true);
          }}
          style={{ cursor: 'pointer' }}
        >
          <div
            className="position-relative mx-auto"
            style={{
              width: isInventory ? 'calc(100% - 14px)' : (isCompact ? 'min(100%, 10.5rem)' : 'min(100%, 22rem)'),
              height: isInventory ? '11rem' : (isCompact ? '7.25rem' : '18rem'),
              ...previewStyle,
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
                    transform: `translate(${depth * (isCompact ? 8 : (isInventory ? 6 : 16))}px, ${depth * (isCompact ? 7 : (isInventory ? 5 : 14))}px)`,
                    zIndex: index + 1,
                    borderColor: '#d8cbb4',
                  }}
                >
                  <RefreshingImage image={image} variant="thumbnail" alt={image.fileName || title} style={{ width: '100%', height: '100%', objectFit: 'contain', backgroundColor: '#f8faf8', display: 'block' }} />
                </div>
              );
            })}
            <div className="position-absolute bottom-0 start-0 m-2">
              <Badge bg="dark">{displayImages.length} image(s)</Badge>
            </div>
          </div>
        </button>
      )}

      <Modal show={show} onHide={() => setShow(false)} centered size={modalSize}>
        <Modal.Header closeButton><Modal.Title>{title}</Modal.Title></Modal.Header>
        <Modal.Body>
          {isSingle && activeImage ? (
            <div className="position-relative p-3 p-lg-4">
              {imageActions(activeImage)}
              <RefreshingImage image={activeImage} alt={activeImage.fileName || title} className="img-fluid" style={{ width: '100%', maxHeight: '65vh', objectFit: 'contain', backgroundColor: '#f7f4ee' }} />
              {descriptionContent(activeImage, 'mt-3 px-5')}
            </div>
          ) : (
            <Carousel className="stacked-image-gallery-carousel" activeIndex={activeIndex} onSelect={selectedIndex => setActiveIndex(selectedIndex || 0)} interval={null} style={{ border: '1px solid #d8cbb4', borderRadius: '0.75rem', overflow: 'hidden', backgroundColor: '#f7f4ee' }}>
              {displayImages.map((image, index) => (
                <Carousel.Item key={image.id || index}>
                  <div className="position-relative p-3 p-lg-4 pb-5">
                    {imageActions(image)}
                    <RefreshingImage image={image} alt={image.fileName || `${title} ${index + 1}`} className="img-fluid" style={{ width: '100%', maxHeight: '65vh', objectFit: 'contain', backgroundColor: '#f7f4ee' }} />
                    {descriptionContent(image, 'mt-3 px-5')}
                  </div>
                </Carousel.Item>
              ))}
            </Carousel>
          )}
        </Modal.Body>
      </Modal>
    </>
  );
}
