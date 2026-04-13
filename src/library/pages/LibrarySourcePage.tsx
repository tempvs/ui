import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Button, Col, Form, Modal, Row } from 'react-bootstrap';
import { FaTrashAlt } from 'react-icons/fa';
import { useIntl } from 'react-intl';
import { useNavigate, useParams } from 'react-router-dom';

import EditableTextFieldRow from '../../component/EditableTextFieldRow';
import EditableTextareaFieldRow from '../../component/EditableTextareaFieldRow';
import IconActionButton from '../../component/IconActionButton';
import PlusActionButton from '../../component/PlusActionButton';
import StackedImageGallery from '../../component/StackedImageGallery';
import Spinner from '../../component/Spinner';
import {
  deleteSourceImage,
  getSource,
  getSourceImages,
  LibrarySource,
  LibrarySourceImage,
  LibraryUserInfoPayload,
  patchSourceField,
  removeSource,
  updateSourceImageDescription,
  uploadSourceImage,
} from '../libraryApi';
import LibraryPeriodBreadcrumb from '../components/LibraryPeriodBreadcrumb';
import LibrarySectionHeader from '../components/LibrarySectionHeader';
import { getClassificationLabel, getTypeLabel } from '../libraryShared';
import { canContribute, canDeleteSource, canEditSource } from '../libraryRoles';
import { readFileAsBase64 } from '../../util/fileUtils';
import { getErrorMessage } from '../../util/errors';
import { clearAllTimers, clearTimer } from '../../util/timers';
import { SaveStatus } from '../../component/EditableFieldRow';

type SourceField = 'name' | 'description';

type SourceFieldStatuses = Partial<Record<SourceField, SaveStatus>>;

type ImageRecord<T> = Record<string | number, T>;

const TrashIcon = FaTrashAlt as React.ComponentType;

export default function LibrarySourcePage() {
  const { sourceId } = useParams();
  const navigate = useNavigate();
  const intl = useIntl();
  const [loading, setLoading] = useState(true);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [source, setSource] = useState<LibrarySource | null>(null);
  const [images, setImages] = useState<LibrarySourceImage[]>([]);
  const [userInfo, setUserInfo] = useState<LibraryUserInfoPayload>(null);
  const [error, setError] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftDescription, setDraftDescription] = useState('');
  const [fieldStatuses, setFieldStatuses] = useState<SourceFieldStatuses>({});
  const [imageDescription, setImageDescription] = useState('');
  const [imageDrafts, setImageDrafts] = useState<ImageRecord<string>>({});
  const [imageStatuses, setImageStatuses] = useState<ImageRecord<SaveStatus>>({});
  const imageInputRef = useRef<HTMLInputElement>(null);
  const replaceImageInputRef = useRef<HTMLInputElement>(null);
  const imageSaveTimersRef = useRef<ImageRecord<number>>({});
  const fieldSaveTimersRef = useRef<Partial<Record<SourceField, number>>>({});
  const replacingImageRef = useRef<LibrarySourceImage | null>(null);

  const loadSource = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const sourceResult = await getSource(sourceId);
      if (!sourceResult.ok) {
        throw new Error('Unable to load the source.');
      }

      const imageResult = await getSourceImages(sourceId);
      if (!imageResult.ok) {
        throw new Error('Unable to load source images.');
      }

      setSource(sourceResult.data);
      setDraftName(sourceResult.data?.name || '');
      setDraftDescription(sourceResult.data?.description || '');
      setFieldStatuses({});
      setImages(Array.isArray(imageResult.data) ? imageResult.data : []);
      setImageDrafts(Object.fromEntries((Array.isArray(imageResult.data) ? imageResult.data : []).map(image => [
        image.id,
        image.description || '',
      ])));
      setImageStatuses({});
      setUserInfo(sourceResult.userInfo);
    } catch (fetchError) {
      setError(getErrorMessage(fetchError));
    } finally {
      setLoading(false);
    }
  }, [sourceId]);

  useEffect(() => {
    loadSource();
  }, [loadSource]);

  useEffect(() => () => {
    clearAllTimers(imageSaveTimersRef.current);
    clearAllTimers(fieldSaveTimersRef.current);
  }, []);

  const patchSource = async (field: SourceField, value: string) => {
    const persistedValue = field === 'name'
      ? (source?.name || '')
      : (source?.description || '');
    if ((value || '') === persistedValue) {
      setFieldStatuses(prevState => ({
        ...prevState,
        [field]: null,
      }));
      return;
    }

    try {
      setError(null);
      setFieldStatuses(prevState => ({
        ...prevState,
        [field]: 'saving',
      }));
      const result = await patchSourceField(sourceId, field, value);

      if (!result.ok) {
        throw new Error(`Unable to update source ${field}.`);
      }

      setSource(prevState => prevState ? { ...prevState, [field]: value } : prevState);
      setFieldStatuses(prevState => ({
        ...prevState,
        [field]: 'saved',
      }));
      window.setTimeout(() => {
        setFieldStatuses(prevState => ({
          ...prevState,
          [field]: null,
        }));
      }, 1000);
    } catch (fetchError) {
      if (field === 'name') {
        setDraftName(persistedValue);
      } else {
        setDraftDescription(persistedValue);
      }
      setFieldStatuses(prevState => ({
        ...prevState,
        [field]: 'error',
      }));
      window.setTimeout(() => {
        setFieldStatuses(prevState => ({
          ...prevState,
          [field]: null,
        }));
      }, 1500);
      setError(getErrorMessage(fetchError));
    }
  };

  const scheduleFieldSave = (field: SourceField, value: string) => {
    if (fieldSaveTimersRef.current[field]) {
      clearTimeout(fieldSaveTimersRef.current[field]);
    }
    setFieldStatuses(prevState => ({
      ...prevState,
      [field]: value === ((field === 'name' ? source?.name : source?.description) || '') ? null : 'pending',
    }));
    fieldSaveTimersRef.current[field] = window.setTimeout(() => {
      patchSource(field, value);
    }, 1800);
  };

  const handleFieldBlur = (field: SourceField) => {
    clearTimer(fieldSaveTimersRef.current, field);
    patchSource(field, field === 'name' ? draftName : draftDescription);
  };

  const handleDeleteSource = async () => {
    if (!source) {
      return;
    }

    if (!window.confirm('Delete this source?')) {
      return;
    }

    try {
      const result = await removeSource(sourceId);
      if (!result.ok) {
        throw new Error(
          (typeof result.data === 'string' && result.data)
          || (result.data && typeof result.data === 'object' && 'message' in result.data ? result.data.message : null)
          || 'Unable to delete the source.'
        );
      }

      navigate(`/library/period/${(source.period || '').toLowerCase()}`);
    } catch (fetchError) {
      setError(getErrorMessage(fetchError));
    }
  };

  const handleUploadImage: React.FormEventHandler<HTMLFormElement> = async event => {
    event.preventDefault();
    const file = imageInputRef.current?.files?.[0];

    if (!file) {
      setError('Choose an image to upload.');
      return;
    }

    setUploadingImage(true);
    setError(null);

    try {
      const content = await readFileAsBase64(file);
      const result = await uploadSourceImage(sourceId, {
        content,
        fileName: file.name,
        description: imageDescription || null,
      });

      if (!result.ok) {
        throw new Error('Unable to upload the image.');
      }

      if (imageInputRef.current) {
        imageInputRef.current.value = '';
      }
      setImageDescription('');
      setShowUploadModal(false);
      await loadSource();
    } catch (fetchError) {
      setError(getErrorMessage(fetchError));
    } finally {
      setUploadingImage(false);
    }
  };

  const handleOpenReplaceImagePicker = (image: LibrarySourceImage) => {
    replacingImageRef.current = image;
    if (replaceImageInputRef.current) {
      replaceImageInputRef.current.value = '';
      replaceImageInputRef.current.click();
    }
  };

  const handleReplaceImage: React.ChangeEventHandler<HTMLInputElement> = async event => {
    const file = event.target.files?.[0];
    const targetImage = replacingImageRef.current;

    if (!file || !targetImage) {
      return;
    }

    setUploadingImage(true);
    setError(null);

    try {
      const content = await readFileAsBase64(file);
      const uploadResult = await uploadSourceImage(sourceId, {
        content,
        fileName: file.name,
        description: imageDrafts[targetImage.id] ?? targetImage.description ?? null,
      });

      if (!uploadResult.ok) {
        throw new Error('Unable to replace the image.');
      }

      const deleteResult = await deleteSourceImage(sourceId, targetImage.id);
      if (!deleteResult.ok) {
        throw new Error('Replacement uploaded, but the old image could not be removed.');
      }

      await loadSource();
    } catch (fetchError) {
      setError(getErrorMessage(fetchError));
    } finally {
      setUploadingImage(false);
      replacingImageRef.current = null;
      event.target.value = '';
    }
  };

  const clearImageSaveTimer = (imageId: LibrarySourceImage['id']) => {
    clearTimer(imageSaveTimersRef.current, String(imageId));
  };

  const resetImageStatusLater = (imageId: LibrarySourceImage['id'], delay = 1000) => {
    window.setTimeout(() => {
      setImageStatuses(prevState => ({
        ...prevState,
        [imageId]: null,
      }));
    }, delay);
  };

  const handleDeleteImage = async (imageId: LibrarySourceImage['id']) => {
    try {
      const result = await deleteSourceImage(sourceId, imageId);

      if (!result.ok) {
        throw new Error('Unable to delete the image.');
      }

      clearImageSaveTimer(imageId);
      await loadSource();
    } catch (fetchError) {
      setError(getErrorMessage(fetchError));
    }
  };

  const handleUpdateImageDescription = async (imageId: LibrarySourceImage['id'], nextValue = imageDrafts[imageId] || '') => {
    const persistedValue = images.find(image => image.id === imageId)?.description || '';
    if ((nextValue || '') === persistedValue) {
      setImageStatuses(prevState => ({
        ...prevState,
        [imageId]: null,
      }));
      return;
    }

    try {
      setImageStatuses(prevState => ({
        ...prevState,
        [imageId]: 'saving',
      }));
      const result = await updateSourceImageDescription(sourceId, imageId, nextValue);

      if (!result.ok) {
        throw new Error('Unable to update the image description.');
      }

      setImages(prevState => prevState.map(image => (
        image.id === imageId
          ? { ...image, description: nextValue }
          : image
      )));
      setImageStatuses(prevState => ({
        ...prevState,
        [imageId]: 'saved',
      }));
      resetImageStatusLater(imageId);
    } catch (fetchError) {
      setImageDrafts(prevState => ({
        ...prevState,
        [imageId]: persistedValue,
      }));
      setImageStatuses(prevState => ({
        ...prevState,
        [imageId]: 'error',
      }));
      resetImageStatusLater(imageId, 1500);
      setError(getErrorMessage(fetchError));
    }
  };

  const handleImageDescriptionChange = (imageId: LibrarySourceImage['id'], value: string) => {
    setImageDrafts(prevState => ({
      ...prevState,
      [imageId]: value,
    }));
    setImageStatuses(prevState => ({
      ...prevState,
      [imageId]: value === (images.find(image => image.id === imageId)?.description || '') ? null : 'pending',
    }));
    clearImageSaveTimer(imageId);
    imageSaveTimersRef.current[imageId] = window.setTimeout(() => {
      handleUpdateImageDescription(imageId, value);
    }, 1800);
  };

  const handleImageDescriptionBlur = (imageId: LibrarySourceImage['id']) => {
    clearImageSaveTimer(imageId);
    handleUpdateImageDescription(imageId);
  };

  if (loading) {
    return <Spinner />;
  }

  if (!source) {
    return (
        <div className="px-4 px-xl-5 pb-4">
        <Alert variant="danger">Source not found.</Alert>
      </div>
    );
  }

  const headerTitle = [
    'SOURCE',
    getClassificationLabel(intl, source.classification),
    getTypeLabel(intl, source.type),
  ].filter(Boolean).join(' \u2022 ');

  return (
    <div className="px-4 px-xl-5 pb-4">
      <LibrarySectionHeader
        title={headerTitle}
        subtitle={null}
        period={source.period}
        variant="source"
        rightContent={(
          <LibraryPeriodBreadcrumb
            period={source.period}
            variant="source"
            trailingItem={{
              label: source.name,
              to: `/library/source/${source.id}`,
            }}
          />
        )}
      />

      {canDeleteSource(userInfo) && (
        <div className="d-flex justify-content-end mb-4">
          <IconActionButton
            title="Delete source"
            onClick={handleDeleteSource}
            borderColor="#c77d7d"
            color="#8e2323"
            backgroundColor="#fff"
            size="1.9rem"
            fontSize="0.9rem"
          >
            <TrashIcon />
          </IconActionButton>
        </div>
      )}

      {error && <Alert variant="danger">{error}</Alert>}

      <div className="stash-shell p-3 p-lg-4">
        <Row className="g-3">
          <Col lg={12}>
            <article className="stash-item-card source-display-tile p-3 position-relative">
              <Row className="g-3">
                <Col md={7}>
                  <div className="stash-subheading">Source details</div>
                  <div className="stash-source-copy">
                    <EditableTextFieldRow
                      label=""
                      editable={canEditSource(userInfo)}
                      value={draftName}
                      onChange={event => {
                        const value = event.target.value;
                        setDraftName(value);
                        scheduleFieldSave('name', value);
                      }}
                      onBlur={() => handleFieldBlur('name')}
                      readOnlyValue={source.name}
                      status={fieldStatuses.name}
                      className="mb-2"
                      fieldMaxWidth="100%"
                      savingTitle="Saving"
                      errorTitle="Save failed"
                    />
                    <EditableTextareaFieldRow
                      label=""
                      editable={canEditSource(userInfo)}
                      value={draftDescription}
                      onChange={event => {
                        const value = event.target.value;
                        setDraftDescription(value);
                        scheduleFieldSave('description', value);
                      }}
                      onBlur={() => handleFieldBlur('description')}
                      readOnlyValue={source.description || '-'}
                      status={fieldStatuses.description}
                      className=""
                      fieldMaxWidth="100%"
                      savingTitle="Saving"
                      errorTitle="Save failed"
                    />
                  </div>
                </Col>
                <Col md={5}>
                  <div className="stash-image-stack-panel">
                    <div className="d-flex align-items-center justify-content-between gap-2 mb-2">
                      <div className="stash-subheading mb-0">Images</div>
                      {canContribute(userInfo) && (
                        <PlusActionButton
                          title="Upload image"
                          onClick={() => {
                            setError(null);
                            setShowUploadModal(true);
                          }}
                        />
                      )}
                    </div>

                    {canContribute(userInfo) && (
                      <Form.Control
                        ref={replaceImageInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleReplaceImage}
                        className="d-none"
                      />
                    )}

                    <StackedImageGallery
                      images={images}
                      title={source.name || undefined}
                      emptyText="No images uploaded for this source yet."
                      previewSize="compact"
                      editable={canEditSource(userInfo)}
                      onDeleteImage={handleDeleteImage}
                      onReplaceImage={handleOpenReplaceImagePicker}
                      imageDrafts={imageDrafts}
                      imageStatuses={imageStatuses}
                      onDescriptionChange={handleImageDescriptionChange}
                      onDescriptionBlur={handleImageDescriptionBlur}
                    />
                  </div>
                </Col>
              </Row>
            </article>
          </Col>
        </Row>
      </div>

      {canContribute(userInfo) && (
        <Modal
          show={showUploadModal}
          onHide={() => {
            if (!uploadingImage) {
              setShowUploadModal(false);
            }
          }}
          centered
        >
          <Modal.Header closeButton={!uploadingImage}>
            <Modal.Title>Upload source image</Modal.Title>
          </Modal.Header>
          <Form onSubmit={handleUploadImage}>
            <Modal.Body>
              <Form.Group className="mb-3">
                <Form.Label>Image file</Form.Label>
                <Form.Control ref={imageInputRef} type="file" accept="image/*" />
              </Form.Group>
              <Form.Group>
                <Form.Label>Description</Form.Label>
                <Form.Control
                  value={imageDescription}
                  onChange={event => setImageDescription(event.target.value)}
                  placeholder="Optional description"
                />
              </Form.Group>
            </Modal.Body>
            <Modal.Footer>
              <Button
                type="button"
                variant="outline-secondary"
                onClick={() => setShowUploadModal(false)}
                disabled={uploadingImage}
              >
                Cancel
              </Button>
              <Button type="submit" variant="dark" disabled={uploadingImage}>
                {uploadingImage ? 'Uploading...' : 'Upload'}
              </Button>
            </Modal.Footer>
          </Form>
        </Modal>
      )}
    </div>
  );
}
