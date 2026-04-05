import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Badge, Button, Card, Col, Dropdown, Form, OverlayTrigger, Row } from 'react-bootstrap';
import { FormattedMessage, useIntl } from 'react-intl';
import { Link, useNavigate, useParams } from 'react-router-dom';

import HoverPopover from '../component/HoverPopover';
import ModalImage from '../component/ModalImage';
import Spinner from '../component/Spinner';
import PeriodTile from './PeriodTile';

const PERIODS = [
  'ANCIENT',
  'ANTIQUITY',
  'EARLY_MIDDLE_AGES',
  'HIGH_MIDDLE_AGES',
  'LATE_MIDDLE_AGES',
  'RENAISSANCE',
  'MODERN',
  'WWI',
  'WWII',
  'CONTEMPORARY',
  'OTHER',
];

const CLASSIFICATIONS = ['CLOTHING', 'FOOTWEAR', 'HOUSEHOLD', 'WEAPON', 'ARMOR', 'OTHER'];
const TYPES = ['WRITTEN', 'GRAPHIC', 'ARCHAEOLOGICAL', 'OTHER'];
const PAGE_SIZE = 40;

function parseUserInfo(headerValue) {
  if (!headerValue) {
    return null;
  }

  try {
    return JSON.parse(headerValue);
  } catch (error) {
    return null;
  }
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const userInfo = parseUserInfo(response.headers.get('User-Info'));
  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (error) {
      data = text;
    }
  }
  return {
    ok: response.ok,
    status: response.status,
    data,
    userInfo,
  };
}

function buildSearchQuery(query, period, classifications, types) {
  return window.btoa(encodeURIComponent(JSON.stringify({
    query,
    period,
    classifications,
    types,
  })));
}

function getRoles(userInfo) {
  return new Set(userInfo?.roles || []);
}

function canContribute(userInfo) {
  const roles = getRoles(userInfo);
  return roles.has('ROLE_CONTRIBUTOR') || roles.has('ROLE_SCRIBE') || roles.has('ROLE_ARCHIVARIUS') || roles.has('ROLE_ADMIN');
}

function canEditSource(userInfo) {
  const roles = getRoles(userInfo);
  return roles.has('ROLE_SCRIBE') || roles.has('ROLE_ARCHIVARIUS') || roles.has('ROLE_ADMIN');
}

function canDeleteSource(userInfo) {
  const roles = getRoles(userInfo);
  return roles.has('ROLE_ARCHIVARIUS') || roles.has('ROLE_ADMIN');
}

function PeriodBadge({ period }) {
  const intl = useIntl();
  const periodKey = period?.toLowerCase?.();

  if (!periodKey) {
    return null;
  }

  return (
    <Badge bg="light" text="dark" className="border">
      {intl.formatMessage({ id: `period.${periodKey}.heading`, defaultMessage: period })}
    </Badge>
  );
}

function getPeriodLabel(intl, period) {
  const periodKey = period?.toLowerCase?.();
  if (!periodKey) {
    return '';
  }

  return intl.formatMessage({ id: `period.${periodKey}.heading`, defaultMessage: period });
}

function getRoleLabel(role) {
  switch (role) {
    case 'ROLE_ADMIN':
      return 'Admin';
    case 'ROLE_ARCHIVARIUS':
      return 'Archivarius';
    case 'ROLE_SCRIBE':
      return 'Scribe';
    case 'ROLE_CONTRIBUTOR':
      return 'Contributor';
    default:
      return null;
  }
}

function getRoleDescription(role) {
  switch (role) {
    case 'ROLE_ADMIN':
      return 'Can manage role requests and all library sources.';
    case 'ROLE_ARCHIVARIUS':
      return 'Can moderate sources, images, and review library requests.';
    case 'ROLE_SCRIBE':
      return 'Can edit source details and curate attached images.';
    case 'ROLE_CONTRIBUTOR':
      return 'Can add new sources and upload supporting images.';
    default:
      return null;
  }
}

function getPrimaryRole(userInfo) {
  const roles = getRoles(userInfo);
  if (roles.has('ROLE_ADMIN')) {
    return 'ROLE_ADMIN';
  }
  if (roles.has('ROLE_ARCHIVARIUS')) {
    return 'ROLE_ARCHIVARIUS';
  }
  if (roles.has('ROLE_SCRIBE')) {
    return 'ROLE_SCRIBE';
  }
  if (roles.has('ROLE_CONTRIBUTOR')) {
    return 'ROLE_CONTRIBUTOR';
  }
  return null;
}

function LibraryPeriodBreadcrumb({ period, variant = 'period' }) {
  const intl = useIntl();

  if (!period) {
    return null;
  }

  return (
    <div className="d-flex align-items-center gap-2 flex-wrap small ms-auto">
      <Link to="/library" className="text-decoration-underline">Library</Link>
      <span>&gt;</span>
      <Link to={`/library/period/${period.toLowerCase()}`} className="text-decoration-underline">
        {getPeriodLabel(intl, period)}
      </Link>
      <Dropdown align="end">
        <Dropdown.Toggle
          variant="link"
          size="sm"
          className="p-0 text-decoration-none"
          style={{ color: '#000' }}
          id={`library-period-switcher-${variant}`}
        />
        <Dropdown.Menu>
          {PERIODS.map(entry => (
            <Dropdown.Item
              as={Link}
              key={entry}
              to={`/library/period/${entry.toLowerCase()}`}
              active={entry === period}
            >
              {getPeriodLabel(intl, entry)}
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown>
    </div>
  );
}
function LibrarySectionHeader({ title, subtitle, period, variant = 'period', middleContent = null, rightContent = null }) {
  const resolvedRightContent = rightContent || <LibraryPeriodBreadcrumb period={period} variant={variant} />;

  return (
    <>
      <div
        className="p-3 rounded border"
        style={{
          backgroundColor: '#f3efe4',
          borderColor: '#d9ccb0',
        }}
      >
        <div className="d-flex align-items-start justify-content-between gap-3 flex-wrap">
          <div className="me-auto" style={{ minWidth: '8rem' }}>
            <div className="text-uppercase small fw-bold mb-1">
              {title}
            </div>
          </div>
          {middleContent && (
            <div className="flex-grow-1 d-flex justify-content-center" style={{ minWidth: '16rem', maxWidth: '32rem' }}>
              {middleContent}
            </div>
          )}
          {resolvedRightContent}
        </div>
      </div>
      {subtitle && (
        <p className="text-muted mb-4 mt-2">
          {subtitle}
        </p>
      )}
    </>
  );
}

function LibraryLanding() {
  const [loading, setLoading] = useState(true);
  const [welcome, setWelcome] = useState(null);
  const [userInfo, setUserInfo] = useState(null);
  const [error, setError] = useState(null);

  const loadWelcome = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await fetchJson('/api/library/library');
      if (!result.ok) {
        throw new Error('Unable to load the library welcome panel.');
      }

      setWelcome(result.data);
      setUserInfo(result.userInfo);
    } catch (fetchError) {
      setError(fetchError.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWelcome();
  }, []);

  const handleRoleAction = async () => {
    if (!welcome?.role) {
      return;
    }

    setError(null);
    const method = welcome.roleRequestAvailable ? 'POST' : 'DELETE';

    try {
      const result = await fetchJson(`/api/library/library/role/${welcome.role}`, { method });
      if (!result.ok) {
        throw new Error('Unable to update the role request.');
      }

      setWelcome(result.data);
      setUserInfo(result.userInfo);
    } catch (fetchError) {
      setError(fetchError.message);
    }
  };

  const periods = useMemo(
    () => PERIODS.map(period => period.toLowerCase()),
    []
  );
  const roleLabel = getRoleLabel(getPrimaryRole(userInfo));
  const roleDescription = getRoleDescription(getPrimaryRole(userInfo));

  const accessContent = loading ? (
    <div className="py-1">
      <Spinner />
    </div>
  ) : (
    <div className="d-flex align-items-center justify-content-center gap-2 flex-wrap">
      {roleLabel && roleDescription && (
        <OverlayTrigger
          trigger={['hover', 'focus']}
          placement="bottom"
          overlay={<HoverPopover text="" default={roleDescription} />}
        >
          <span className="fw-semibold" style={{ fontSize: '0.95rem', cursor: 'default' }}>
            {roleLabel}
          </span>
        </OverlayTrigger>
      )}
      {welcome?.adminPanelAvailable && (
        <Button as={Link} to="/library/admin" variant="dark" size="sm">
          Open admin panel
        </Button>
      )}
      {!welcome?.adminPanelAvailable && welcome?.buttonText && welcome?.role && (
        <Button variant="outline-dark" size="sm" onClick={handleRoleAction}>
          {welcome.buttonText}
        </Button>
      )}
    </div>
  );

  return (
    <div className="px-4 px-xl-5 py-4">
      <LibrarySectionHeader
        title="LIBRARY"
        subtitle={null}
        period={null}
        variant="landing"
        middleContent={accessContent}
      />
      {error && <Alert variant="danger" className="mt-3">{error}</Alert>}
      <Row className="g-4 align-items-start">
        <Col lg={12}>
          <div className="d-flex flex-column gap-3">
            <div>
              <h1 className="mb-2">
                <FormattedMessage id="periods.title" defaultMessage="Historical periods" />
              </h1>
              <p className="text-muted small mb-0">
                Browse the catalogue by era, then drill into individual sources and their image gallery.
              </p>
            </div>
            <Row className="g-3">
              {periods.map(period => (
                <Col md={6} xl={4} key={period}>
                  <Link to={`/library/period/${period}`} className="text-decoration-none text-reset">
                    <PeriodTile period={period} />
                  </Link>
                </Col>
              ))}
            </Row>
          </div>
        </Col>
      </Row>
    </div>
  );
}

function SourceCard({ source }) {
  return (
    <Card className="h-100 border-0 shadow-sm">
      <Card.Body className="d-flex flex-column">
        <div className="d-flex align-items-start justify-content-between gap-2 mb-2">
          <Card.Title className="mb-0 fs-5">{source.name}</Card.Title>
          <PeriodBadge period={source.period} />
        </div>
        <Card.Text className="text-muted flex-grow-1">
          {source.description || 'No description yet.'}
        </Card.Text>
        <div className="d-flex gap-2 flex-wrap mb-3">
          <Badge bg="secondary">{source.classification}</Badge>
          <Badge bg="info">{source.type}</Badge>
        </div>
        <Button as={Link} to={`/library/source/${source.id}`} variant="outline-dark">
          Open source
        </Button>
      </Card.Body>
    </Card>
  );
}

function LibraryPeriodPage() {
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

function LibraryAdminPage() {
  const [loading, setLoading] = useState(true);
  const [roleRequests, setRoleRequests] = useState([]);
  const [error, setError] = useState(null);

  const loadRoleRequests = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await fetchJson(`/api/library/library/admin?page=0&size=${PAGE_SIZE}`);
      if (!result.ok) {
        throw new Error(result.status === 403 ? 'Admin access is required.' : 'Unable to load role requests.');
      }

      setRoleRequests(result.data?.roleRequests || []);
    } catch (fetchError) {
      setError(fetchError.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRoleRequests();
  }, []);

  const updateRoleRequest = async (role, userId, method) => {
    setError(null);

    try {
      const result = await fetchJson(`/api/library/library/${role}/${userId}`, { method });
      if (!result.ok) {
        throw new Error('Unable to update the role request.');
      }

      setRoleRequests(result.data?.roleRequests || []);
    } catch (fetchError) {
      setError(fetchError.message);
    }
  };

  return (
    <div className="px-4 px-xl-5 py-4">
      <LibrarySectionHeader
        title="LIBRARY"
        subtitle="Review contributor, scribe, and archivarius requests."
        period={null}
        variant="admin"
        rightContent={(
          <div className="d-flex align-items-center gap-2 flex-wrap small ms-auto">
            <Link to="/library" className="text-decoration-underline">Library</Link>
            <span>&gt;</span>
            <Link to="/library/admin" className="text-decoration-underline">Admin</Link>
          </div>
        )}
      />

      {error && <Alert variant="danger">{error}</Alert>}
      {loading && <Spinner />}
      {!loading && (
        <div className="d-flex flex-column gap-3">
          {roleRequests.length === 0 && (
            <Alert variant="light" className="border mb-0">No pending role requests.</Alert>
          )}
          {roleRequests.map(request => (
            <Card key={`${request.userId}-${request.role}`} className="border-0 shadow-sm">
              <Card.Body className="d-flex align-items-center justify-content-between gap-3 flex-wrap">
                <div>
                  <div className="fw-semibold">
                    <Link to={`/profile/${request.profileId}`}>{request.userName}</Link>
                  </div>
                  <div className="text-muted small">{request.roleLabel}</div>
                </div>
                <div className="d-flex gap-2">
                  <Button variant="outline-success" onClick={() => updateRoleRequest(request.role, request.userId, 'POST')}>
                    Approve
                  </Button>
                  <Button variant="outline-danger" onClick={() => updateRoleRequest(request.role, request.userId, 'DELETE')}>
                    Reject
                  </Button>
                </div>
              </Card.Body>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function LibrarySourcePage() {
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
      const sourceResult = await fetchJson(`/api/library/source/${sourceId}`);
      if (!sourceResult.ok) {
        throw new Error('Unable to load the source.');
      }

      const imageResult = await fetchJson(`/api/image/image/source/${sourceId}`);
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
      const response = await fetch(`/api/library/source/${sourceId}/${field}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ [field]: value }),
      });

      if (!response.ok) {
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
      const response = await fetch(`/api/library/source/${sourceId}`, { method: 'DELETE' });
      if (!response.ok) {
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
      const response = await fetch(`/api/library/source/${sourceId}/images`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content,
          fileName: file.name,
          description: imageDescription || null,
        }),
      });

      if (!response.ok) {
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
      const response = await fetch(`/api/library/source/${sourceId}/images/${imageId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
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

export default function LibraryPage({ view = 'landing' }) {
  if (view === 'period') {
    return <LibraryPeriodPage />;
  }

  if (view === 'source') {
    return <LibrarySourcePage />;
  }

  if (view === 'admin') {
    return <LibraryAdminPage />;
  }

  return <LibraryLanding />;
}


