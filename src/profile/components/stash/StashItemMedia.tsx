import React from 'react';

import PlusActionButton from '../../../component/PlusActionButton';
import Spinner from '../../../component/Spinner';
import StackedImageGallery from '../../../component/StackedImageGallery';
import { SaveStatus } from '../../../component/EditableFieldRow';
import { Id, MessageFormatter, StashItem, StashItemImage } from '../../profileTypes';

type IdRecord<T> = Record<Id, T>;

type StashItemMediaProps = {
  item: StashItem;
  images: StashItemImage[];
  loading: boolean;
  editable: boolean;
  imageDrafts: IdRecord<string>;
  imageStatuses: IdRecord<SaveStatus>;
  t: MessageFormatter;
  onUpload: () => void;
  onDeleteImage: (imageId: Id) => void;
  onReplaceImage: (image: StashItemImage) => void;
  onDescriptionChange: (imageId: Id, value: string) => void;
  onDescriptionBlur: (imageId: Id) => void;
};

export default function StashItemMedia({
  item,
  images,
  loading,
  editable,
  imageDrafts,
  imageStatuses,
  t,
  onUpload,
  onDeleteImage,
  onReplaceImage,
  onDescriptionChange,
  onDescriptionBlur,
}: StashItemMediaProps) {
  return (
    <div className="stash-item-media">
      {editable && (
        <div className="stash-item-media-action">
          <PlusActionButton
            title={t('profile.stash.itemImageUpload', 'Upload image')}
            onClick={onUpload}
          />
        </div>
      )}
      {loading && (
        <div className="stash-item-media-empty">
          <Spinner size="sm" />
        </div>
      )}
      {!loading && images.length > 0 && (
        <StackedImageGallery
          images={images}
          title={item.name || undefined}
          emptyText={t('profile.stash.imagesEmpty', 'No images uploaded for this item yet.')}
          previewSize="inventory"
          editable={editable}
          onDeleteImage={editable ? onDeleteImage : undefined}
          onReplaceImage={editable ? onReplaceImage : undefined}
          imageDrafts={imageDrafts}
          imageStatuses={imageStatuses}
          onDescriptionChange={onDescriptionChange}
          onDescriptionBlur={onDescriptionBlur}
        />
      )}
      {!loading && images.length === 0 && (
        <button
          type="button"
          className="stash-item-media-empty"
          onClick={() => {
            if (editable) {
              onUpload();
            }
          }}
          disabled={!editable}
        >
          {t('profile.stash.imagesEmptyShort', 'No images')}
        </button>
      )}
    </div>
  );
}
