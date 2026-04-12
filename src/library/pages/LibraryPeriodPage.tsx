import React, { useEffect, useState } from 'react';
import { Alert, Button, Card, Col, Form, Modal, Row } from 'react-bootstrap';
import { useIntl } from 'react-intl';
import { useNavigate, useParams } from 'react-router-dom';

import PlusActionButton from '../../component/PlusActionButton';
import SearchActionButton from '../../component/SearchActionButton';
import Spinner from '../../component/Spinner';
import { createSource, findSources, LibrarySource } from '../libraryApi';
import LibraryPeriodBreadcrumb from '../components/LibraryPeriodBreadcrumb';
import LibrarySectionHeader from '../components/LibrarySectionHeader';
import SourceCard from '../components/SourceCard';
import {
  CLASSIFICATIONS,
  getClassificationLabel,
  getPeriodLabel,
  getTypeLabel,
  PAGE_SIZE,
  TYPES,
} from '../libraryShared';
import { canContribute } from '../libraryRoles';

export default function LibraryPeriodPage() {
  const { period } = useParams();
  const navigate = useNavigate();
  const intl = useIntl();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  const [sources, setSources] = useState([]);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [selectedClassifications, setSelectedClassifications] = useState([]);
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [draftSource, setDraftSource] = useState({
    name: '',
    description: '',
    classification: '',
    type: '',
  });

  const periodCode = (period || '').toUpperCase();

  const searchSources = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await findSources({
        query,
        period: periodCode,
        classifications: selectedClassifications,
        types: selectedTypes,
        page: 0,
        size: PAGE_SIZE,
      });

      if (!result.ok) {
        throw new Error('Unable to load sources for this period.');
      }

      setSources(Array.isArray(result.data) ? result.data : []);
      setUserInfo(result.userInfo);
    } catch (fetchError) {
      setError(fetchError.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    searchSources();
  }, [periodCode]);

  const handleToggle = (value, selectedValues, setter) => {
    setter(
      selectedValues.includes(value)
        ? selectedValues.filter(entry => entry !== value)
        : [...selectedValues, value]
    );
  };

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    searchSources();
  };

  const handleCreateSource = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const result = await createSource({
        ...draftSource,
        period: periodCode,
      });

      if (!result.ok) {
        const message = result.data && 'message' in result.data ? result.data.message : null;
        throw new Error(message || 'Unable to create the source.');
      }

      if (!result.data || !('id' in result.data)) {
        throw new Error('Unable to create the source.');
      }

      setShowCreateModal(false);
      navigate(`/library/source/${(result.data as LibrarySource).id}`);
    } catch (fetchError) {
      setError(fetchError.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="px-4 px-xl-5 pb-4">
      <LibrarySectionHeader
        title="LIBRARY"
        subtitle={null}
        period={null}
        variant="period"
        rightContent={<LibraryPeriodBreadcrumb period={periodCode} variant="period" />}
      />
      <div className="mb-4 mt-2">
        <h1 className="mb-2">{getPeriodLabel(intl, periodCode)}</h1>
        <p className="text-muted mb-0">
          {intl.formatMessage({ id: `period.${period}.shortDescription`, defaultMessage: 'Historical period overview.' })}
        </p>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      <Row className="g-4 align-items-start">
        <Col lg={4}>
          <Card className="border-0 shadow-sm mb-4">
            <Card.Body>
              <Card.Title>Find sources</Card.Title>
              <Form onSubmit={handleSearchSubmit}>
                <Form.Group className="mb-3">
                  <Form.Label>Search text</Form.Label>
                  <div className="input-group">
                    <Form.Control
                      value={query}
                      onChange={event => setQuery(event.target.value)}
                      placeholder="Name or description"
                    />
                    <SearchActionButton
                      title="Search sources"
                      type="submit"
                      className="rounded-0 rounded-end"
                      borderColor="#ced4da"
                      color="#495057"
                      size="2.375rem"
                    />
                  </div>
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Classification</Form.Label>
                  <div className="d-flex flex-column gap-2">
                    {CLASSIFICATIONS.map(classification => (
                      <Form.Check
                        key={classification}
                        type="checkbox"
                        id={`classification-${classification}`}
                        label={getClassificationLabel(intl, classification)}
                        checked={selectedClassifications.includes(classification)}
                        onChange={() => handleToggle(classification, selectedClassifications, setSelectedClassifications)}
                      />
                    ))}
                  </div>
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Type</Form.Label>
                  <div className="d-flex flex-column gap-2">
                    {TYPES.map(type => (
                      <Form.Check
                        key={type}
                        type="checkbox"
                        id={`type-${type}`}
                        label={getTypeLabel(intl, type)}
                        checked={selectedTypes.includes(type)}
                        onChange={() => handleToggle(type, selectedTypes, setSelectedTypes)}
                      />
                    ))}
                  </div>
                </Form.Group>
              </Form>
            </Card.Body>
          </Card>

        </Col>
        <Col lg={8}>
          {loading && <Spinner />}
          {!loading && (
            <>
              <div className="d-flex align-items-center justify-content-between mb-3">
                <h2 className="mb-0 fs-4">Sources</h2>
                <div className="d-flex align-items-center gap-2">
                  <div className="text-muted small">{sources.length} result(s)</div>
                  {canContribute(userInfo) && (
                    <PlusActionButton
                      title="Create source"
                      onClick={() => {
                        setError(null);
                        setDraftSource({
                          name: '',
                          description: '',
                          classification: '',
                          type: '',
                        });
                        setShowCreateModal(true);
                      }}
                    />
                  )}
                </div>
              </div>
              {sources.length === 0 && (
                <Alert variant="light" className="border">No sources matched the current filters.</Alert>
              )}
              <Row className="g-3">
                {sources.map(source => (
                  <Col md={6} key={source.id}>
                    <SourceCard source={source} />
                  </Col>
                ))}
              </Row>
            </>
          )}
        </Col>
      </Row>

      {canContribute(userInfo) && (
        <Modal
          show={showCreateModal}
          onHide={() => {
            if (!submitting) {
              setShowCreateModal(false);
            }
          }}
          centered
        >
          <Modal.Header closeButton={!submitting}>
            <Modal.Title>Create source</Modal.Title>
          </Modal.Header>
          <Form onSubmit={handleCreateSource}>
            <Modal.Body>
              <Form.Group className="mb-3">
                <Form.Label>Name</Form.Label>
                <Form.Control
                  required
                  value={draftSource.name}
                  onChange={event => setDraftSource(prev => ({ ...prev, name: event.target.value }))}
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Description</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  value={draftSource.description}
                  onChange={event => setDraftSource(prev => ({ ...prev, description: event.target.value }))}
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Classification</Form.Label>
                <Form.Select
                  required
                  value={draftSource.classification}
                  onChange={event => setDraftSource(prev => ({ ...prev, classification: event.target.value }))}
                >
                  <option value="">Choose classification</option>
                  {CLASSIFICATIONS.map(classification => (
                    <option key={classification} value={classification}>{getClassificationLabel(intl, classification)}</option>
                  ))}
                </Form.Select>
              </Form.Group>
              <Form.Group>
                <Form.Label>Type</Form.Label>
                <Form.Select
                  required
                  value={draftSource.type}
                  onChange={event => setDraftSource(prev => ({ ...prev, type: event.target.value }))}
                >
                  <option value="">Choose type</option>
                  {TYPES.map(type => (
                    <option key={type} value={type}>{getTypeLabel(intl, type)}</option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Modal.Body>
            <Modal.Footer>
              <Button
                type="button"
                variant="outline-secondary"
                onClick={() => setShowCreateModal(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" variant="dark" disabled={submitting}>
                {submitting ? 'Creating...' : 'Create source'}
              </Button>
            </Modal.Footer>
          </Form>
        </Modal>
      )}
    </div>
  );
}
