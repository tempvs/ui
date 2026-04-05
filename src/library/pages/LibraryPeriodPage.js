import React, { useEffect, useState } from 'react';
import { Alert, Button, Card, Col, Form, Row } from 'react-bootstrap';
import { useIntl } from 'react-intl';
import { useNavigate, useParams } from 'react-router-dom';

import Spinner from '../../component/Spinner';
import LibraryPeriodBreadcrumb from '../components/LibraryPeriodBreadcrumb';
import LibrarySectionHeader from '../components/LibrarySectionHeader';
import SourceCard from '../components/SourceCard';
import {
  buildSearchQuery,
  canContribute,
  CLASSIFICATIONS,
  fetchJson,
  getPeriodLabel,
  PAGE_SIZE,
  TYPES,
} from '../libraryShared';

export default function LibraryPeriodPage() {
  const { period } = useParams();
  const navigate = useNavigate();
  const intl = useIntl();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
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
      const encodedQuery = buildSearchQuery(
        query,
        periodCode,
        selectedClassifications,
        selectedTypes
      );
      const result = await fetchJson(`/api/library/source/find?page=0&size=${PAGE_SIZE}&q=${encodedQuery}`);

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
      const response = await fetch('/api/library/source', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...draftSource,
          period: periodCode,
        }),
      });

      const text = await response.text();
      const data = text ? JSON.parse(text) : null;

      if (!response.ok) {
        throw new Error(data?.message || 'Unable to create the source.');
      }

      navigate(`/library/source/${data.id}`);
    } catch (fetchError) {
      setError(fetchError.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="px-4 px-xl-5 py-4">
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
                  <Form.Control
                    value={query}
                    onChange={event => setQuery(event.target.value)}
                    placeholder="Name or description"
                  />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Classification</Form.Label>
                  <div className="d-flex flex-column gap-2">
                    {CLASSIFICATIONS.map(classification => (
                      <Form.Check
                        key={classification}
                        type="checkbox"
                        id={`classification-${classification}`}
                        label={classification}
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
                        label={type}
                        checked={selectedTypes.includes(type)}
                        onChange={() => handleToggle(type, selectedTypes, setSelectedTypes)}
                      />
                    ))}
                  </div>
                </Form.Group>
                <Button type="submit" variant="dark">Search</Button>
              </Form>
            </Card.Body>
          </Card>

          {canContribute(userInfo) && (
            <Card className="border-0 shadow-sm">
              <Card.Body>
                <Card.Title>Create source</Card.Title>
                <Form onSubmit={handleCreateSource}>
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
                        <option key={classification} value={classification}>{classification}</option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                  <Form.Group className="mb-3">
                    <Form.Label>Type</Form.Label>
                    <Form.Select
                      required
                      value={draftSource.type}
                      onChange={event => setDraftSource(prev => ({ ...prev, type: event.target.value }))}
                    >
                      <option value="">Choose type</option>
                      {TYPES.map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                  <Button type="submit" variant="outline-dark" disabled={submitting}>
                    {submitting ? 'Creating...' : 'Create source'}
                  </Button>
                </Form>
              </Card.Body>
            </Card>
          )}
        </Col>
        <Col lg={8}>
          {loading && <Spinner />}
          {!loading && (
            <>
              <div className="d-flex align-items-center justify-content-between mb-3">
                <h2 className="mb-0 fs-4">Sources</h2>
                <div className="text-muted small">{sources.length} result(s)</div>
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
    </div>
  );
}
