import React, { useEffect, useRef, useState } from 'react';
import { Alert, Button, Card, Col, Form, Modal, Row } from 'react-bootstrap';
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

export default function LibrarySourcePage() {
  const { sourceId } = useParams();
  const navigate = useNavigate();
  const intl = useIntl();
  const [loading, setLoading] = useState(true);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [source, setSource] = useState(null);
  const [images, setImages] = useState([]);
  const [userInfo, setUserInfo] = useState(null);
  const [error, setError] = useState(null);
  const [draftName, setDraftName] = useState('');
  const [draftDescription, setDraftDescription] = useState('');
  const [fieldStatuses, setFieldStatuses] = useState({});
  const [imageDescription, setImageDescription] = useState('');
  const [imageDrafts, setImageDrafts] = useState({});
  const [imageStatuses, setImageStatuses] = useState({});
  const imageInputRef = useRef(null);
  const replaceImageInputRef = useRef(null);
  const imageSaveTimersRef = useRef({});
  const fieldSaveTimersRef = useRef({});
  const replacingImageRef = useRef(null);

  const loadSource = async () => {
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
      setError(fetchError.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSource();
  }, [sourceId]);

  useEffect(() => () => {
    Object.values(imageSaveTimersRef.current).forEach(timerId => clearTimeout(timerId));
    Object.values(fieldSaveTimersRef.current).forEach(timerId => clearTimeout(timerId));
  }, []);

  const patchSource = async (field, value) => {
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
      setError(fetchError.message);
    }
  };

  const scheduleFieldSave = (field, value) => {
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

  const handleFieldBlur = (field) => {
    if (fieldSaveTimersRef.current[field]) {
      clearTimeout(fieldSaveTimersRef.current[field]);
      delete fieldSaveTimersRef.current[field];
    }
    patchSource(field, field === 'name' ? draftName : draftDescription);
  };

  const handleDeleteSource = async () => {
    if (!window.confirm('Delete this source?')) {
      return;
    }

    try {
      const result = await removeSource(sourceId);
      if (!result.ok) {
        throw new Error(
          (typeof result.data === 'string' && result.data)
          || result.data?.message
          || 'Unable to delete the source.'
        );
      }

      navigate(`/library/period/${source.period.toLowerCase()}`);
    } catch (fetchError) {
      setError(fetchError.message);
    }
  };

  const handleUploadImage = async (event) => {
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
      setError(fetchError.message);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleOpenReplaceImagePicker = (image) => {
    replacingImageRef.current = image;
    if (replaceImageInputRef.current) {
      replaceImageInputRef.current.value = '';
      replaceImageInputRef.current.click();
    }
  };

  const handleReplaceImage = async (event) => {
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
      setError(fetchError.message);
    } finally {
      setUploadingImage(false);
      replacingImageRef.current = null;
      event.target.value = '';
    }
  };

  const clearImageSaveTimer = (imageId) => {
    if (imageSaveTimersRef.current[imageId]) {
      clearTimeout(imageSaveTimersRef.current[imageId]);
      delete imageSaveTimersRef.current[imageId];
    }
  };

  const resetImageStatusLater = (imageId, delay = 1000) => {
    window.setTimeout(() => {
      setImageStatuses(prevState => ({
        ...prevState,
        [imageId]: null,
      }));
    }, delay);
  };

  const handleDeleteImage = async (imageId) => {
    try {
      const result = await deleteSourceImage(sourceId, imageId);

      if (!result.ok) {
        throw new Error('Unable to delete the image.');
      }

      clearImageSaveTimer(imageId);
      await loadSource();
    } catch (fetchError) {
      setError(fetchError.message);
    }
  };

  const handleUpdateImageDescription = async (imageId, nextValue = imageDrafts[imageId] || '') => {
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
      setError(fetchError.message);
    }
  };

  const handleImageDescriptionChange = (imageId, value) => {
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

  const handleImageDescriptionBlur = (imageId) => {
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
    source.name,
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
            <FaTrashAlt />
          </IconActionButton>
        </div>
      )}

      {error && <Alert variant="danger">{error}</Alert>}

      <Row className="g-4 align-items-start">
        <Col lg={5}>
          <Card className="border-0 shadow-sm">
            <Card.Body>
              <Card.Title>Source details</Card.Title>
              <EditableTextFieldRow
                label="Name"
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
                className="mb-3"
                savingTitle="Saving"
                errorTitle="Save failed"
              />
              <EditableTextareaFieldRow
                label="Description"
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
                savingTitle="Saving"
                errorTitle="Save failed"
              />
            </Card.Body>
          </Card>
        </Col>
        <Col lg={7}>
          <Card className="border-0 shadow-sm">
            <Card.Body>
              <div className="d-flex align-items-center justify-content-between gap-3 flex-wrap mb-3">
                <Card.Title className="mb-0">Images</Card.Title>
                <div className="d-flex align-items-center gap-2">
                  <div className="text-muted small">{images.length} image(s)</div>
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
              </div>

              {canContribute(userInfo) && (
                <>
                  <Form.Control
                    ref={replaceImageInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleReplaceImage}
                    className="d-none"
                  />
                </>
              )}

              {images.length === 0 && (
                <Alert variant="light" className="border mb-0">No images uploaded for this source yet.</Alert>
              )}

              {images.length > 0 && (
                <div className="mb-4">
                    <StackedImageGallery
                      images={images}
                      title={source.name}
                      emptyText="No images uploaded for this source yet."
                      editable={canEditSource(userInfo)}
                      onDeleteImage={handleDeleteImage}
                      onReplaceImage={handleOpenReplaceImagePicker}
                      imageDrafts={imageDrafts}
                      imageStatuses={imageStatuses}
                      onDescriptionChange={handleImageDescriptionChange}
                    onDescriptionBlur={handleImageDescriptionBlur}
                  />
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

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
