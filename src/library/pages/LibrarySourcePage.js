import React, { useEffect, useRef, useState } from 'react';
import { Alert, Badge, Button, Card, Col, Form, Row } from 'react-bootstrap';
import { FaTrashAlt } from 'react-icons/fa';
import { useNavigate, useParams } from 'react-router-dom';

import EditableImageDescription from '../../component/EditableImageDescription';
import EditableTextFieldRow from '../../component/EditableTextFieldRow';
import EditableTextareaFieldRow from '../../component/EditableTextareaFieldRow';
import IconActionButton from '../../component/IconActionButton';
import ModalImage from '../../component/ModalImage';
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
import LibrarySectionHeader from '../components/LibrarySectionHeader';
import { PeriodBadge } from '../libraryShared';
import { canContribute, canDeleteSource, canEditSource } from '../libraryRoles';

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const commaIndex = result.indexOf(',');
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
    };
    reader.onerror = () => reject(new Error('Unable to read the selected file.'));
    reader.readAsDataURL(file);
  });
}

export default function LibrarySourcePage() {
  const { sourceId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
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
  const imageSaveTimersRef = useRef({});
  const fieldSaveTimersRef = useRef({});

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
      setSaving(true);
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
    } finally {
      setSaving(false);
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
        throw new Error('Unable to delete the source.');
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
      await loadSource();
    } catch (fetchError) {
      setError(fetchError.message);
    } finally {
      setUploadingImage(false);
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
      <div className="px-4 px-xl-5 py-4">
        <Alert variant="danger">Source not found.</Alert>
      </div>
    );
  }

  return (
    <div className="px-4 px-xl-5 py-4">
      <LibrarySectionHeader
        title={source.name}
        subtitle={null}
        period={source.period}
        variant="source"
      />

      <div className="d-flex align-items-start justify-content-between gap-3 flex-wrap mb-4">
        <div className="d-flex gap-2 flex-wrap">
          <Badge bg="secondary">{source.classification}</Badge>
          <Badge bg="info">{source.type}</Badge>
          <PeriodBadge period={source.period} />
        </div>
        {canDeleteSource(userInfo) && (
          <Button variant="outline-danger" onClick={handleDeleteSource}>
            Delete source
          </Button>
        )}
      </div>

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
                readOnlyValue={source.description || 'No description yet.'}
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
                <div className="text-muted small">{images.length} image(s)</div>
              </div>

              {canContribute(userInfo) && (
                <Form className="border rounded p-3 mb-4 bg-light" onSubmit={handleUploadImage}>
                  <Row className="g-3 align-items-end">
                    <Col md={5}>
                      <Form.Label>Image file</Form.Label>
                      <Form.Control ref={imageInputRef} type="file" accept="image/*" />
                    </Col>
                    <Col md={5}>
                      <Form.Label>Description</Form.Label>
                      <Form.Control
                        value={imageDescription}
                        onChange={event => setImageDescription(event.target.value)}
                        placeholder="Optional description"
                      />
                    </Col>
                    <Col md={2}>
                      <Button type="submit" variant="dark" disabled={uploadingImage} className="w-100">
                        {uploadingImage ? 'Uploading...' : 'Upload'}
                      </Button>
                    </Col>
                  </Row>
                </Form>
              )}

              {images.length === 0 && (
                <Alert variant="light" className="border mb-0">No images uploaded for this source yet.</Alert>
              )}

              <Row className="g-3">
                {images.map(image => (
                  <Col md={6} key={image.id}>
                    <Card className="h-100">
                      <Card.Body>
                        <div className="position-relative">
                          <ModalImage
                            url={image.url}
                            alt={image.fileName || source.name}
                            description={image.description}
                            wrapperStyle={{ maxWidth: '100%' }}
                            imageStyle={{ borderRadius: '0.5rem', objectFit: 'cover', aspectRatio: '4 / 3' }}
                          />
                          {canEditSource(userInfo) && (
                            <IconActionButton
                              className="position-absolute top-0 end-0 m-2"
                              fontSize="0.85rem"
                              onClick={() => handleDeleteImage(image.id)}
                              title="Delete image"
                            >
                              <FaTrashAlt />
                            </IconActionButton>
                          )}
                        </div>
                        {canEditSource(userInfo) ? (
                          <EditableImageDescription
                            editable
                            value={imageDrafts[image.id] || ''}
                            status={imageStatuses[image.id]}
                            className="mt-3"
                            bordered={false}
                            placeholder="Image description"
                            onChange={event => handleImageDescriptionChange(image.id, event.target.value)}
                            onBlur={() => handleImageDescriptionBlur(image.id)}
                            savingTitle="Saving"
                            errorTitle="Save failed"
                          />
                        ) : (
                          <EditableImageDescription
                            editable={false}
                            value={image.description}
                            emptyText="No description"
                            className="mt-3"
                            bordered={false}
                          />
                        )}
                      </Card.Body>
                    </Card>
                  </Col>
                ))}
              </Row>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
