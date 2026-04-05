import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Col, Form, Modal, Row, Spinner } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { FaLink, FaPlus, FaSave, FaSearch, FaTrashAlt, FaUnlink } from 'react-icons/fa';

const ALL_SOURCE_TYPES = ['WRITTEN', 'GRAPHIC', 'ARCHAEOLOGICAL', 'OTHER'];

const emptyGroupForm = { name: '', description: '' };

const emptyItemForm = classification => ({
  name: '',
  description: '',
  classification: classification || 'OTHER',
});

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const error = new Error(`Request failed with status ${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

function encodeLibraryQuery(payload) {
  return window.btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
}

function buildProfileLabel(profile) {
  return `${profile?.firstName || ''} ${profile?.lastName || ''}`.trim() || 'Club profile';
}

function buildSourceLookupMap(sources) {
  return sources.reduce((accumulator, source) => ({
    ...accumulator,
    [source.id]: source,
  }), {});
}

export default function StashPanel({ profile, isEditable, t, getPeriodLabel }) {
  const [stash, setStash] = useState(null);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [groupForm, setGroupForm] = useState(emptyGroupForm);
  const [groupSubmitting, setGroupSubmitting] = useState(false);
  const [groupDrafts, setGroupDrafts] = useState({});
  const [itemDrafts, setItemDrafts] = useState({});
  const [itemsByGroup, setItemsByGroup] = useState({});
  const [itemsLoading, setItemsLoading] = useState({});
  const [itemCreateTarget, setItemCreateTarget] = useState(null);
  const [itemCreateForm, setItemCreateForm] = useState(emptyItemForm(profile?.period));
  const [itemCreateSubmitting, setItemCreateSubmitting] = useState(false);
  const [sourceDetails, setSourceDetails] = useState({});
  const [sourceSearch, setSourceSearch] = useState({});

  const isClubProfile = profile?.type === 'CLUB';
  const profileLabel = useMemo(() => buildProfileLabel(profile), [profile]);

  useEffect(() => {
    setGroupForm(emptyGroupForm);
    setItemCreateTarget(null);
    setItemCreateForm(emptyItemForm(profile?.period));
    setSourceSearch({});
  }, [profile?.id, profile?.period]);

  useEffect(() => {
    if (!isClubProfile || !profile?.id) {
      setStash(null);
      setFeedback(null);
      return;
    }

    loadStash();
  }, [isClubProfile, profile?.id]);

  async function loadStash() {
    setLoading(true);
    setFeedback(null);

    try {
      const payload = await requestJson(`/api/stash/group/profile/${profile.id}`);
      setStash(payload);
      const groups = payload?.groups || [];
      setGroupDrafts(Object.fromEntries(groups.map(group => [group.id, {
        name: group.name || '',
        description: group.description || '',
      }])));
      await Promise.all(groups.map(group => loadItems(group.id)));
    } catch (error) {
      setStash(null);
      setFeedback({
        variant: 'warning',
        text: t('profile.stash.loadFailed', 'Unable to load this club stash right now.'),
      });
    } finally {
      setLoading(false);
    }
  }

  async function loadItems(groupId) {
    setItemsLoading(prevState => ({ ...prevState, [groupId]: true }));

    try {
      const items = await requestJson(`/api/stash/group/${groupId}/item?page=0&size=40`);
      setItemsByGroup(prevState => ({ ...prevState, [groupId]: items || [] }));
      setItemDrafts(prevState => ({
        ...prevState,
        ...Object.fromEntries((items || []).map(item => [item.id, {
          name: item.name || '',
          description: item.description || '',
        }])),
      }));
      await hydrateSources(items || []);
    } catch (error) {
      setItemsByGroup(prevState => ({ ...prevState, [groupId]: [] }));
    } finally {
      setItemsLoading(prevState => ({ ...prevState, [groupId]: false }));
    }
  }

  async function hydrateSources(items) {
    const ids = [...new Set(items.flatMap(item => item.sources || []))]
      .filter(id => !sourceDetails[id]);

    if (!ids.length) {
      return;
    }

    try {
      const query = encodeURIComponent(encodeLibraryQuery({ ids }));
      const sources = await requestJson(`/api/library/source?q=${query}`);
      setSourceDetails(prevState => ({
        ...prevState,
        ...buildSourceLookupMap(Array.isArray(sources) ? sources : []),
      }));
    } catch (error) {
      // ignore source hydration failures in the first pass
    }
  }

  async function handleCreateGroup(event) {
    event.preventDefault();
    setGroupSubmitting(true);
    setFeedback(null);

    try {
      await requestJson(`/api/stash/group/profile/${profile.id}`, {
        method: 'POST',
        body: JSON.stringify(groupForm),
      });
      setGroupForm(emptyGroupForm);
      await loadStash();
      setFeedback({
        variant: 'success',
        text: t('profile.stash.groupCreateSuccess', 'Collection created.'),
      });
    } catch (error) {
      setFeedback({
        variant: 'danger',
        text: t('profile.stash.groupCreateFailed', 'Unable to create a collection.'),
      });
    } finally {
      setGroupSubmitting(false);
    }
  }

  async function handleSaveGroup(group) {
    const draft = groupDrafts[group.id];
    if (!draft) {
      return;
    }

    try {
      if (draft.name !== group.name) {
        await requestJson(`/api/stash/group/${group.id}/name`, {
          method: 'PATCH',
          body: JSON.stringify({ name: draft.name }),
        });
      }

      if ((draft.description || '') !== (group.description || '')) {
        await requestJson(`/api/stash/group/${group.id}/description`, {
          method: 'PATCH',
          body: JSON.stringify({ description: draft.description }),
        });
      }

      await loadStash();
      setFeedback({
        variant: 'success',
        text: t('profile.stash.groupSaveSuccess', 'Collection updated.'),
      });
    } catch (error) {
      setFeedback({
        variant: 'danger',
        text: t('profile.stash.groupSaveFailed', 'Unable to save collection changes.'),
      });
    }
  }

  function openCreateItem(group) {
    setItemCreateTarget(group);
    setItemCreateForm(emptyItemForm(group?.items?.[0]?.classification || 'OTHER'));
  }

  async function handleCreateItem(event) {
    event.preventDefault();
    if (!itemCreateTarget) {
      return;
    }

    setItemCreateSubmitting(true);
    setFeedback(null);

    try {
      await requestJson(`/api/stash/group/${itemCreateTarget.id}/item`, {
        method: 'POST',
        body: JSON.stringify({
          ...itemCreateForm,
          period: profile.period,
        }),
      });
      setItemCreateTarget(null);
      setItemCreateForm(emptyItemForm(profile?.period));
      await loadItems(itemCreateTarget.id);
      await loadStash();
      setFeedback({
        variant: 'success',
        text: t('profile.stash.itemCreateSuccess', 'Item added.'),
      });
    } catch (error) {
      setFeedback({
        variant: 'danger',
        text: t('profile.stash.itemCreateFailed', 'Unable to add this item.'),
      });
    } finally {
      setItemCreateSubmitting(false);
    }
  }

  async function handleSaveItem(item) {
    const draft = itemDrafts[item.id];
    if (!draft) {
      return;
    }

    try {
      if (draft.name !== item.name) {
        await requestJson(`/api/stash/item/${item.id}/name`, {
          method: 'PATCH',
          body: JSON.stringify({ name: draft.name }),
        });
      }

      if ((draft.description || '') !== (item.description || '')) {
        await requestJson(`/api/stash/item/${item.id}/description`, {
          method: 'PATCH',
          body: JSON.stringify({ description: draft.description }),
        });
      }

      await loadItems(item.itemGroup.id);
      setFeedback({
        variant: 'success',
        text: t('profile.stash.itemSaveSuccess', 'Item updated.'),
      });
    } catch (error) {
      setFeedback({
        variant: 'danger',
        text: t('profile.stash.itemSaveFailed', 'Unable to save item changes.'),
      });
    }
  }

  async function handleDeleteItem(item) {
    try {
      await requestJson(`/api/stash/item/${item.id}`, { method: 'DELETE' });
      await loadItems(item.itemGroup.id);
      setFeedback({
        variant: 'success',
        text: t('profile.stash.itemDeleteSuccess', 'Item deleted.'),
      });
    } catch (error) {
      setFeedback({
        variant: 'danger',
        text: t('profile.stash.itemDeleteFailed', 'Unable to delete this item.'),
      });
    }
  }

  async function handleSearchSources(item) {
    const query = sourceSearch[item.id]?.query || '';
    setSourceSearch(prevState => ({
      ...prevState,
      [item.id]: {
        ...(prevState[item.id] || {}),
        loading: true,
        error: null,
      },
    }));

    try {
      const encodedQuery = encodeURIComponent(encodeLibraryQuery({
        query,
        period: item.period,
        classifications: [item.classification],
        types: ALL_SOURCE_TYPES,
      }));
      const results = await requestJson(`/api/library/source/find?page=0&size=20&q=${encodedQuery}`);
      setSourceSearch(prevState => ({
        ...prevState,
        [item.id]: {
          ...(prevState[item.id] || {}),
          loading: false,
          results: Array.isArray(results) ? results : [],
          error: null,
        },
      }));
    } catch (error) {
      setSourceSearch(prevState => ({
        ...prevState,
        [item.id]: {
          ...(prevState[item.id] || {}),
          loading: false,
          results: [],
          error: t('profile.stash.sourceSearchFailed', 'Unable to search library sources.'),
        },
      }));
    }
  }

  async function handleLinkSource(item, sourceId) {
    try {
      await requestJson(`/api/stash/item/${item.id}/source/${sourceId}`, { method: 'POST' });
      await loadItems(item.itemGroup.id);
      setFeedback({
        variant: 'success',
        text: t('profile.stash.sourceLinkSuccess', 'Source linked.'),
      });
    } catch (error) {
      setFeedback({
        variant: 'danger',
        text: t('profile.stash.sourceLinkFailed', 'Unable to link this source.'),
      });
    }
  }

  async function handleUnlinkSource(item, sourceId) {
    try {
      await requestJson(`/api/stash/item/${item.id}/source/${sourceId}`, { method: 'DELETE' });
      await loadItems(item.itemGroup.id);
      setFeedback({
        variant: 'success',
        text: t('profile.stash.sourceUnlinkSuccess', 'Source unlinked.'),
      });
    } catch (error) {
      setFeedback({
        variant: 'danger',
        text: t('profile.stash.sourceUnlinkFailed', 'Unable to unlink this source.'),
      });
    }
  }

  if (!isClubProfile) {
    return null;
  }

  return (
    <div className="mt-4 pt-2">
      <div className="p-3 p-lg-4 rounded border" style={{ backgroundColor: '#f7f4ee', borderColor: '#d9ccb8' }}>
        <div className="d-flex justify-content-between align-items-start gap-3 flex-wrap mb-3">
          <div>
            <div className="text-uppercase small fw-bold text-secondary">
              {t('profile.stash.eyebrow', 'Club stash')}
            </div>
            <h4 className="mb-1">{t('profile.stash.title', 'Belongings and kit')}</h4>
            <div className="small text-muted">
              {t('profile.stash.subtitle', 'Structured belongings for this club profile, supported by linked library sources.')}
            </div>
          </div>
          <div className="small text-muted">
            {profileLabel}
            {profile?.period ? ` • ${getPeriodLabel(profile.period)}` : ''}
          </div>
        </div>

        {feedback && <Alert variant={feedback.variant} className="py-2">{feedback.text}</Alert>}
        {loading && <Spinner animation="border" size="sm" />}

        {!loading && isEditable && (
          <Form onSubmit={handleCreateGroup} className="mb-4">
            <Row className="g-2 align-items-end">
              <Col md={4}>
                <Form.Label className="small mb-1">{t('profile.stash.groupName', 'Collection name')}</Form.Label>
                <Form.Control
                  size="sm"
                  value={groupForm.name}
                  onChange={event => setGroupForm(prevState => ({ ...prevState, name: event.target.value }))}
                  placeholder={t('profile.stash.groupNamePlaceholder', 'Helmet, camp, wardrobe...')}
                />
              </Col>
              <Col md={5}>
                <Form.Label className="small mb-1">{t('profile.stash.groupDescription', 'Collection note')}</Form.Label>
                <Form.Control
                  size="sm"
                  value={groupForm.description}
                  onChange={event => setGroupForm(prevState => ({ ...prevState, description: event.target.value }))}
                  placeholder={t('profile.stash.groupDescriptionPlaceholder', 'What this collection covers')}
                />
              </Col>
              <Col md={3}>
                <Button type="submit" size="sm" variant="secondary" disabled={groupSubmitting || !groupForm.name.trim()}>
                  <FaPlus className="me-2" />
                  {t('profile.stash.groupCreate', 'Create collection')}
                </Button>
              </Col>
            </Row>
          </Form>
        )}

        {!loading && !stash?.groups?.length && (
          <div className="small text-muted">
            {t('profile.stash.empty', 'No collections yet. Start by creating the first group of belongings.')}
          </div>
        )}

        <div className="d-grid gap-3">
          {(stash?.groups || []).map(group => {
            const items = itemsByGroup[group.id] || [];
            const searchStateByItem = sourceSearch;

            return (
              <div key={group.id} className="rounded border bg-white p-3" style={{ borderColor: '#e3d8c6' }}>
                <div className="d-flex justify-content-between align-items-start gap-3 flex-wrap">
                  <div className="flex-grow-1">
                    {isEditable ? (
                      <Row className="g-2">
                        <Col md={4}>
                          <Form.Control
                            size="sm"
                            value={groupDrafts[group.id]?.name || ''}
                            onChange={event => setGroupDrafts(prevState => ({
                              ...prevState,
                              [group.id]: {
                                ...prevState[group.id],
                                name: event.target.value,
                              },
                            }))}
                          />
                        </Col>
                        <Col md={6}>
                          <Form.Control
                            size="sm"
                            value={groupDrafts[group.id]?.description || ''}
                            onChange={event => setGroupDrafts(prevState => ({
                              ...prevState,
                              [group.id]: {
                                ...prevState[group.id],
                                description: event.target.value,
                              },
                            }))}
                          />
                        </Col>
                        <Col md={2} className="d-flex justify-content-end">
                          <Button size="sm" variant="outline-secondary" onClick={() => handleSaveGroup(group)}>
                            <FaSave className="me-2" />
                            {t('profile.stash.save', 'Save')}
                          </Button>
                        </Col>
                      </Row>
                    ) : (
                      <>
                        <div className="fw-semibold">{group.name}</div>
                        {group.description && <div className="small text-muted">{group.description}</div>}
                      </>
                    )}
                  </div>
                  <div className="small text-muted">
                    {group.profile?.period ? getPeriodLabel(group.profile.period) : getPeriodLabel(profile.period)}
                  </div>
                </div>

                <div className="mt-3">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <div className="small text-uppercase text-muted fw-bold">
                      {t('profile.stash.itemsTitle', 'Items')}
                    </div>
                    {isEditable && (
                      <Button size="sm" variant="outline-secondary" onClick={() => openCreateItem(group)}>
                        <FaPlus className="me-2" />
                        {t('profile.stash.itemCreate', 'Add item')}
                      </Button>
                    )}
                  </div>

                  {itemsLoading[group.id] && <Spinner animation="border" size="sm" />}
                  {!itemsLoading[group.id] && !items.length && (
                    <div className="small text-muted">
                      {t('profile.stash.itemsEmpty', 'No items in this collection yet.')}
                    </div>
                  )}

                  <div className="d-grid gap-3">
                    {items.map(item => {
                      const sourceState = searchStateByItem[item.id] || {};
                      return (
                        <div key={item.id} className="rounded border p-3" style={{ borderColor: '#ebe4d8', backgroundColor: '#fcfbf8' }}>
                          <Row className="g-3">
                            <Col lg={6}>
                              {isEditable ? (
                                <>
                                  <Form.Control
                                    size="sm"
                                    className="mb-2"
                                    value={itemDrafts[item.id]?.name || ''}
                                    onChange={event => setItemDrafts(prevState => ({
                                      ...prevState,
                                      [item.id]: {
                                        ...prevState[item.id],
                                        name: event.target.value,
                                      },
                                    }))}
                                  />
                                  <Form.Control
                                    size="sm"
                                    as="textarea"
                                    rows={2}
                                    value={itemDrafts[item.id]?.description || ''}
                                    onChange={event => setItemDrafts(prevState => ({
                                      ...prevState,
                                      [item.id]: {
                                        ...prevState[item.id],
                                        description: event.target.value,
                                      },
                                    }))}
                                  />
                                  <div className="d-flex gap-2 mt-2">
                                    <Button size="sm" variant="outline-secondary" onClick={() => handleSaveItem(item)}>
                                      <FaSave className="me-2" />
                                      {t('profile.stash.save', 'Save')}
                                    </Button>
                                    <Button size="sm" variant="outline-danger" onClick={() => handleDeleteItem(item)}>
                                      <FaTrashAlt className="me-2" />
                                      {t('profile.stash.delete', 'Delete')}
                                    </Button>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div className="fw-semibold">{item.name}</div>
                                  {item.description && <div className="small text-muted">{item.description}</div>}
                                </>
                              )}
                            </Col>
                            <Col lg={6}>
                              <div className="d-flex gap-2 flex-wrap mb-2">
                                <Badge bg="secondary">{item.classification}</Badge>
                                <Badge bg="light" text="dark">{getPeriodLabel(item.period)}</Badge>
                              </div>

                              <div className="small text-uppercase text-muted fw-bold mb-2">
                                {t('profile.stash.sourcesTitle', 'Linked sources')}
                              </div>

                              {(item.sources || []).length === 0 && (
                                <div className="small text-muted mb-2">
                                  {t('profile.stash.sourcesEmpty', 'No supporting sources linked yet.')}
                                </div>
                              )}

                              <div className="d-grid gap-2">
                                {(item.sources || []).map(sourceId => {
                                  const source = sourceDetails[sourceId];
                                  return (
                                    <div key={sourceId} className="d-flex align-items-center justify-content-between gap-2">
                                      {source ? (
                                        <Link to={`/library/source/${sourceId}`} className="small text-decoration-none">
                                          {source.name}
                                        </Link>
                                      ) : (
                                        <span className="small text-muted">#{sourceId}</span>
                                      )}
                                      {isEditable && (
                                        <Button size="sm" variant="outline-secondary" onClick={() => handleUnlinkSource(item, sourceId)}>
                                          <FaUnlink />
                                        </Button>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>

                              {isEditable && (
                                <div className="mt-3 pt-2 border-top">
                                  <div className="input-group input-group-sm mb-2">
                                    <Form.Control
                                      value={sourceState.query || ''}
                                      onChange={event => setSourceSearch(prevState => ({
                                        ...prevState,
                                        [item.id]: {
                                          ...(prevState[item.id] || {}),
                                          query: event.target.value,
                                        },
                                      }))}
                                      placeholder={t('profile.stash.sourceSearchPlaceholder', 'Find matching library sources')}
                                    />
                                    <Button variant="outline-secondary" onClick={() => handleSearchSources(item)}>
                                      <FaSearch className="me-2" />
                                      {t('profile.stash.search', 'Search')}
                                    </Button>
                                  </div>
                                  {sourceState.error && <div className="small text-danger mb-2">{sourceState.error}</div>}
                                  {sourceState.loading && <Spinner animation="border" size="sm" />}
                                  {(sourceState.results || []).length > 0 && (
                                    <div className="d-grid gap-2">
                                      {sourceState.results.map(source => (
                                        <div key={source.id} className="d-flex align-items-center justify-content-between gap-2">
                                          <div className="small">
                                            <div className="fw-semibold">{source.name}</div>
                                            <div className="text-muted">{source.type}</div>
                                          </div>
                                          <Button
                                            size="sm"
                                            variant="outline-secondary"
                                            disabled={(item.sources || []).includes(source.id)}
                                            onClick={() => handleLinkSource(item, source.id)}
                                          >
                                            <FaLink className="me-2" />
                                            {t('profile.stash.link', 'Link')}
                                          </Button>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </Col>
                          </Row>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Modal show={Boolean(itemCreateTarget)} onHide={() => setItemCreateTarget(null)} centered>
        <Modal.Header closeButton>
          <Modal.Title>{t('profile.stash.itemCreate', 'Add item')}</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleCreateItem}>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>{t('profile.stash.itemName', 'Item name')}</Form.Label>
              <Form.Control
                value={itemCreateForm.name}
                onChange={event => setItemCreateForm(prevState => ({ ...prevState, name: event.target.value }))}
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>{t('profile.stash.itemDescription', 'Description')}</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={itemCreateForm.description}
                onChange={event => setItemCreateForm(prevState => ({ ...prevState, description: event.target.value }))}
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>{t('profile.stash.itemClassification', 'Classification')}</Form.Label>
              <Form.Select
                value={itemCreateForm.classification}
                onChange={event => setItemCreateForm(prevState => ({ ...prevState, classification: event.target.value }))}
              >
                {['ARMOR', 'CLOTHING', 'FOOTWEAR', 'HOUSEHOLD', 'WEAPON', 'OTHER'].map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </Form.Select>
            </Form.Group>
            <div className="small text-muted">
              {t('profile.stash.itemPeriodInherited', 'Period is inherited from the club profile')}: {getPeriodLabel(profile?.period)}
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="outline-secondary" onClick={() => setItemCreateTarget(null)}>
              {t('profile.action.cancel', 'Cancel')}
            </Button>
            <Button type="submit" variant="secondary" disabled={itemCreateSubmitting || !itemCreateForm.name.trim()}>
              {t('profile.stash.itemCreate', 'Add item')}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
}
