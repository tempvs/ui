import React, { useEffect, useRef, useState } from 'react';
import { Alert, Badge, Button, Card, Col, Form, Row } from 'react-bootstrap';
import { useNavigate, useParams } from 'react-router-dom';

import ModalImage from '../../component/ModalImage';
import Spinner from '../../component/Spinner';
import {
  deleteSourceImage,
  getSource,
  getSourceImages,
  patchSourceField,
  removeSource,
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
  const [imageDescription, setImageDescription] = useState('');
  const imageInputRef = useRef(null);

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
      setImages(Array.isArray(imageResult.data) ? imageResult.data : []);
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

  const patchSource = async (field, value) => {
    setSaving(true);
    setError(null);

    try {
      const result = await patchSourceField(sourceId, field, value);

      if (!result.ok) {
        throw new Error(`Unable to update source ${field}.`);
      }

      await loadSource();
    } catch (fetchError) {
      setError(fetchError.message);
    } finally {
      setSaving(false);
    }
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

  const handleDeleteImage = async (imageId) => {
    try {
      const result = await deleteSourceImage(sourceId, imageId);

      if (!result.ok) {
        throw new Error('Unable to delete the image.');
      }

      await loadSource();
    } catch (fetchError) {
      setError(fetchError.message);
    }
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
              <Form.Group className="mb-3">
                <Form.Label>Name</Form.Label>
                {canEditSource(userInfo) ? (
                  <div className="d-flex gap-2">
                    <Form.Control value={draftName} onChange={event => setDraftName(event.target.value)} />
                    <Button variant="outline-dark" disabled={saving} onClick={() => patchSource('name', draftName)}>
                      Save
                    </Button>
                  </div>
                ) : (
                  <div>{source.name}</div>
                )}
              </Form.Group>
              <Form.Group>
                <Form.Label>Description</Form.Label>
                {canEditSource(userInfo) ? (
                  <>
                    <Form.Control
                      as="textarea"
                      rows={5}
                      value={draftDescription}
                      onChange={event => setDraftDescription(event.target.value)}
                      className="mb-2"
                    />
                    <Button variant="outline-dark" disabled={saving} onClick={() => patchSource('description', draftDescription)}>
                      Save description
                    </Button>
                  </>
                ) : (
                  <div className="text-muted">{source.description || 'No description yet.'}</div>
                )}
              </Form.Group>
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
                        <ModalImage
                          url={image.url}
                          alt={image.fileName || source.name}
                          description={image.description}
                          wrapperStyle={{ maxWidth: '100%' }}
                          imageStyle={{ borderRadius: '0.5rem', objectFit: 'cover', aspectRatio: '4 / 3' }}
                        />
                        <div className="mt-3 small text-muted">{image.description || 'No description'}</div>
                        {canEditSource(userInfo) && (
                          <Button
                            variant="outline-danger"
                            size="sm"
                            className="mt-3"
                            onClick={() => handleDeleteImage(image.id)}
                          >
                            Delete image
                          </Button>
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
