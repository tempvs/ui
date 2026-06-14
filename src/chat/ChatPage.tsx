import React, { FormEvent, useEffect, useState } from 'react';
import { Alert, Badge, Button, Container, Form, Spinner } from 'react-bootstrap';
import { useNavigate, useParams } from 'react-router-dom';
import { FormattedMessage, useIntl } from 'react-intl';

import SectionHeaderBar from '../component/SectionHeaderBar';
import { fetchClubProfiles, fetchCurrentUserInfo, fetchUserProfileByUserId, searchProfiles } from '../profile/profileApi';
import { Profile } from '../profile/profileTypes';
import { createConversation, getConversation, listConversations, sendMessage } from './chatApi';
import { ChatConversationDetails, ChatConversationSummary } from './chatTypes';

function buildProfileLabel(profile: Profile | null | undefined) {
  if (!profile) {
    return '';
  }
  const fullName = `${profile.firstName || ''} ${profile.lastName || ''}`.trim();
  return fullName || profile.alias || `Profile ${profile.id}`;
}

function formatDate(value?: string | null) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleString();
}

function toPromiseUserProfile(userId: number) {
  return new Promise<Profile | null>((resolve, reject) => {
    fetchUserProfileByUserId(userId, {
      onSuccess: profile => resolve(profile || null),
      onMissing: () => resolve(null),
      onError: () => reject(new Error('Unable to load user profile')),
    });
  });
}

function toPromiseClubProfiles(userId: number) {
  return new Promise<Profile[]>((resolve, reject) => {
    fetchClubProfiles(userId, {
      onSuccess: profiles => resolve(Array.isArray(profiles) ? profiles : []),
      onError: () => reject(new Error('Unable to load club profiles')),
    });
  });
}

export default function ChatPage() {
  const intl = useIntl();
  const navigate = useNavigate();
  const { conversationId } = useParams();

  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [senderProfiles, setSenderProfiles] = useState<Profile[]>([]);
  const [selectedSenderId, setSelectedSenderId] = useState<number | null>(null);
  const [conversations, setConversations] = useState<ChatConversationSummary[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<ChatConversationDetails | null>(null);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [messageDraft, setMessageDraft] = useState('');
  const [participantQuery, setParticipantQuery] = useState('');
  const [participantResults, setParticipantResults] = useState<Profile[]>([]);
  const [participantLoading, setParticipantLoading] = useState(false);
  const [selectedParticipants, setSelectedParticipants] = useState<Profile[]>([]);
  const [groupTitle, setGroupTitle] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [signedOut, setSignedOut] = useState(false);

  useEffect(() => {
    fetchCurrentUserInfo(result => {
      if (!result.currentUserId) {
        setSignedOut(true);
        setLoadingProfiles(false);
        setLoadingConversations(false);
        return;
      }

      setCurrentUserId(Number(result.currentUserId));
    });
  }, []);

  useEffect(() => {
    if (currentUserId == null) {
      return;
    }

    let cancelled = false;
    const resolvedUserId = currentUserId;

    async function loadProfiles() {
      setLoadingProfiles(true);
      setFeedback(null);
      try {
        const [userProfile, clubProfiles] = await Promise.all([
          toPromiseUserProfile(resolvedUserId),
          toPromiseClubProfiles(resolvedUserId),
        ]);
        if (cancelled) {
          return;
        }

        const profiles = [userProfile, ...clubProfiles]
          .filter((profile): profile is Profile => Boolean(profile && profile.id != null));
        setSenderProfiles(profiles);
        setSelectedSenderId(prev => {
          if (prev && profiles.some(profile => Number(profile.id) === prev)) {
            return prev;
          }
          return profiles.length ? Number(profiles[0].id) : null;
        });
      } catch (error) {
        if (!cancelled) {
          setFeedback(intl.formatMessage({
            id: 'chat.profiles.failed',
            defaultMessage: 'Unable to load your sender profiles.',
          }));
        }
      } finally {
        if (!cancelled) {
          setLoadingProfiles(false);
        }
      }
    }

    loadProfiles();
    return () => {
      cancelled = true;
    };
  }, [currentUserId, intl]);

  useEffect(() => {
    if (!senderProfiles.length) {
      return;
    }

    let cancelled = false;

    async function loadConversationsList() {
      setLoadingConversations(true);
      try {
        const data = await listConversations();
        if (!cancelled) {
          setConversations(Array.isArray(data) ? data : []);
        }
      } catch (error) {
        if (!cancelled) {
          setFeedback(intl.formatMessage({
            id: 'chat.conversations.failed',
            defaultMessage: 'Unable to load conversations right now.',
          }));
        }
      } finally {
        if (!cancelled) {
          setLoadingConversations(false);
        }
      }
    }

    loadConversationsList();
    return () => {
      cancelled = true;
    };
  }, [senderProfiles, intl]);

  useEffect(() => {
    if (!conversationId) {
      setSelectedConversation(null);
      return;
    }

    let cancelled = false;
    const resolvedConversationId = conversationId;

    async function loadConversationDetails() {
      setLoadingConversation(true);
      setFeedback(null);
      try {
        const data = await getConversation(resolvedConversationId);
        if (cancelled) {
          return;
        }
        setSelectedConversation(data);
        setSelectedSenderId(prev => {
          if (prev && data.participants.some(participant => participant.profileId === prev)) {
            return prev;
          }
          const ownedParticipant = data.participants.find(participant =>
            senderProfiles.some(profile => Number(profile.id) === participant.profileId)
          );
          return ownedParticipant ? ownedParticipant.profileId : prev;
        });
      } catch (error) {
        if (!cancelled) {
          setSelectedConversation(null);
          setFeedback(intl.formatMessage({
            id: 'chat.conversation.failed',
            defaultMessage: 'Unable to open that conversation.',
          }));
        }
      } finally {
        if (!cancelled) {
          setLoadingConversation(false);
        }
      }
    }

    loadConversationDetails();
    return () => {
      cancelled = true;
    };
  }, [conversationId, senderProfiles, intl]);

  async function refreshConversations(selectedId?: number) {
    const data = await listConversations();
    setConversations(Array.isArray(data) ? data : []);

    if (selectedId != null) {
      navigate(`/chat/${selectedId}`);
    }
  }

  async function handleParticipantSearch(event: FormEvent) {
    event.preventDefault();
    const query = participantQuery.trim();
    if (!query) {
      setParticipantResults([]);
      return;
    }

    setParticipantLoading(true);
    setFeedback(null);
    try {
      const results = await searchProfiles({ query, size: 12 });
      setParticipantResults(results.filter(profile => Number(profile.id) !== selectedSenderId));
    } catch (error) {
      setFeedback(intl.formatMessage({
        id: 'chat.participantSearch.failed',
        defaultMessage: 'Unable to search profiles right now.',
      }));
    } finally {
      setParticipantLoading(false);
    }
  }

  async function handleCreateConversation(event: FormEvent) {
    event.preventDefault();
    if (selectedSenderId == null) {
      return;
    }

    const participantIds = selectedParticipants
      .map(profile => Number(profile.id))
      .filter(profileId => profileId !== selectedSenderId);

    if (!participantIds.length) {
      setFeedback(intl.formatMessage({
        id: 'chat.participants.required',
        defaultMessage: 'Choose at least one participant.',
      }));
      return;
    }

    try {
      const details = await createConversation({
        senderProfileId: selectedSenderId,
        participantProfileIds: participantIds,
        title: participantIds.length > 1 ? groupTitle.trim() || null : null,
      });
      setSelectedParticipants([]);
      setParticipantResults([]);
      setParticipantQuery('');
      setGroupTitle('');
      setFeedback(null);
      await refreshConversations(details.id);
      setSelectedConversation(details);
      navigate(`/chat/${details.id}`);
    } catch (error) {
      const message = error instanceof Error && error.message
        ? error.message
        : intl.formatMessage({
          id: 'chat.create.failed',
          defaultMessage: 'Unable to create conversation.',
        });
      setFeedback(message);
    }
  }

  async function handleSendMessage(event: FormEvent) {
    event.preventDefault();
    if (!selectedConversation || selectedSenderId == null || !messageDraft.trim()) {
      return;
    }

    try {
      const details = await sendMessage(selectedConversation.id, {
        senderProfileId: selectedSenderId,
        text: messageDraft,
      });
      setMessageDraft('');
      setSelectedConversation(details);
      setFeedback(null);
      await refreshConversations(details.id);
    } catch (error) {
      const message = error instanceof Error && error.message
        ? error.message
        : intl.formatMessage({
          id: 'chat.message.failed',
          defaultMessage: 'Unable to send message.',
        });
      setFeedback(message);
    }
  }

  function addParticipant(profile: Profile) {
    setSelectedParticipants(current => {
      if (current.some(entry => Number(entry.id) === Number(profile.id))) {
        return current;
      }
      return [...current, profile];
    });
  }

  function removeParticipant(profileId: number) {
    setSelectedParticipants(current => current.filter(profile => Number(profile.id) !== profileId));
  }

  if (signedOut) {
    return (
      <Container fluid className="chat-shell px-3 px-xl-4">
        <Alert variant="warning" className="mt-4">
          <FormattedMessage id="chat.signInRequired" defaultMessage="Sign in to use chat." />
        </Alert>
      </Container>
    );
  }

  const canSend = Boolean(
    selectedConversation &&
    selectedSenderId != null &&
    selectedConversation.participants.some(participant => participant.profileId === selectedSenderId)
  );

  return (
    <Container fluid className="chat-shell px-3 px-xl-4 py-3 py-xl-4">
      <div className="chat-page-grid">
        <aside className="chat-sidebar-panel">
          <SectionHeaderBar
            title={intl.formatMessage({ id: 'chat.title', defaultMessage: 'Chat' })}
            subtitle={intl.formatMessage({
              id: 'chat.subtitle',
              defaultMessage: 'Switch sender identities, start direct chats, and keep group conversations in one place.',
            })}
          />
          {feedback && <Alert variant="warning" className="chat-feedback">{feedback}</Alert>}
          <div className="chat-create-panel mt-3">
            <div className="chat-panel-heading">
              <FormattedMessage id="chat.newConversation" defaultMessage="New conversation" />
            </div>
            <Form onSubmit={handleCreateConversation} className="chat-create-form">
              <Form.Group className="chat-form-group">
                <Form.Label className="chat-form-label">
                  <FormattedMessage id="chat.sender" defaultMessage="Send as" />
                </Form.Label>
                <Form.Select
                  className="chat-form-input"
                  value={selectedSenderId ?? ''}
                  onChange={event => setSelectedSenderId(Number(event.target.value))}
                  disabled={loadingProfiles || !senderProfiles.length}
                >
                  {senderProfiles.map(profile => (
                    <option key={profile.id} value={profile.id}>
                      {buildProfileLabel(profile)}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
              <Form.Group className="chat-form-group">
                <Form.Label className="chat-form-label">
                  <FormattedMessage id="chat.participantSearch" defaultMessage="Find participants" />
                </Form.Label>
                <div className="chat-search-row">
                  <Form.Control
                    className="chat-form-input"
                    value={participantQuery}
                    onChange={event => setParticipantQuery(event.target.value)}
                    placeholder={intl.formatMessage({
                      id: 'chat.participantSearch.placeholder',
                      defaultMessage: 'Search profiles by name or alias',
                    })}
                  />
                  <Button type="button" className="chat-action-button" onClick={handleParticipantSearch}>
                    <FormattedMessage id="chat.searchButton" defaultMessage="Search" />
                  </Button>
                </div>
              </Form.Group>
              {participantLoading && <Spinner animation="border" size="sm" />}
              {selectedParticipants.length > 0 && (
                <div className="chat-chip-row">
                  {selectedParticipants.map(profile => (
                    <button
                      key={profile.id}
                      type="button"
                      className="chat-chip"
                      onClick={() => removeParticipant(Number(profile.id))}
                    >
                      {buildProfileLabel(profile)} <span>x</span>
                    </button>
                  ))}
                </div>
              )}
              {selectedParticipants.length > 1 && (
                <Form.Group className="chat-form-group">
                  <Form.Label className="chat-form-label">
                    <FormattedMessage id="chat.groupTitle" defaultMessage="Group title" />
                  </Form.Label>
                  <Form.Control
                    className="chat-form-input"
                    value={groupTitle}
                    onChange={event => setGroupTitle(event.target.value)}
                    placeholder={intl.formatMessage({
                      id: 'chat.groupTitle.placeholder',
                      defaultMessage: 'Optional name for this group',
                    })}
                  />
                </Form.Group>
              )}
              {participantResults.length > 0 && (
                <div className="chat-search-results">
                  {participantResults.map(profile => (
                    <button
                      key={profile.id}
                      type="button"
                      className="chat-search-result"
                      onClick={() => addParticipant(profile)}
                    >
                      <span className="chat-search-result-name">{buildProfileLabel(profile)}</span>
                      <Badge bg="light" text="dark">{profile.type || 'PROFILE'}</Badge>
                    </button>
                  ))}
                </div>
              )}
              <Button className="chat-action-button mt-3" type="submit" disabled={loadingProfiles}>
                <FormattedMessage id="chat.createButton" defaultMessage="Create conversation" />
              </Button>
            </Form>
          </div>
          <div className="chat-list-panel mt-3">
            <div className="chat-panel-heading">
              <FormattedMessage id="chat.conversations" defaultMessage="Conversations" />
            </div>
            {loadingConversations && <Spinner animation="border" size="sm" />}
            {!loadingConversations && conversations.length === 0 && (
              <div className="chat-empty-state">
                <FormattedMessage id="chat.empty" defaultMessage="No conversations yet." />
              </div>
            )}
            <div className="chat-conversation-list">
              {conversations.map(conversation => (
                <button
                  key={conversation.id}
                  type="button"
                  className={`chat-conversation-card${String(conversation.id) === String(conversationId) ? ' chat-conversation-card-active' : ''}`}
                  onClick={() => navigate(`/chat/${conversation.id}`)}
                >
                  <div className="chat-conversation-name">{conversation.displayName}</div>
                  <div className="chat-conversation-preview">{conversation.previewText || 'No messages yet.'}</div>
                  <div className="chat-conversation-meta">{formatDate(conversation.updatedAt)}</div>
                </button>
              ))}
            </div>
          </div>
        </aside>
        <section className="chat-main-panel">
          {!conversationId && (
            <div className="chat-empty-workspace">
              <h2 className="chat-workspace-title">
                <FormattedMessage id="chat.workspace.title" defaultMessage="Choose a conversation" />
              </h2>
              <p className="chat-workspace-copy">
                <FormattedMessage
                  id="chat.workspace.copy"
                  defaultMessage="Start a direct chat from the left panel or create a group with several participants."
                />
              </p>
            </div>
          )}
          {conversationId && loadingConversation && (
            <div className="chat-empty-workspace">
              <Spinner animation="border" />
            </div>
          )}
          {selectedConversation && (
            <div className="chat-thread-panel">
              <div className="chat-thread-header">
                <div>
                  <div className="chat-thread-title">{selectedConversation.displayName}</div>
                  <div className="chat-thread-subtitle">
                    {selectedConversation.participants.map(participant => participant.name).join(', ')}
                  </div>
                </div>
                <div className="chat-thread-controls">
                  <Form.Select
                    className="chat-form-input chat-thread-sender-select"
                    value={selectedSenderId ?? ''}
                    onChange={event => setSelectedSenderId(Number(event.target.value))}
                  >
                    {senderProfiles
                      .filter(profile => selectedConversation.participants.some(participant => participant.profileId === Number(profile.id)))
                      .map(profile => (
                        <option key={profile.id} value={profile.id}>
                          {buildProfileLabel(profile)}
                        </option>
                      ))}
                  </Form.Select>
                </div>
              </div>
              <div className="chat-message-list">
                {selectedConversation.messages.length === 0 && (
                  <div className="chat-empty-state">
                    <FormattedMessage id="chat.messages.empty" defaultMessage="No messages yet. Send the first one." />
                  </div>
                )}
                {selectedConversation.messages.map(message => (
                  <article
                    key={message.id}
                    className={`chat-message-card${message.senderProfileId === selectedSenderId ? ' chat-message-card-own' : ''}`}
                  >
                    <div className="chat-message-author">{message.senderName}</div>
                    <div className="chat-message-text">{message.text}</div>
                    <div className="chat-message-date">{formatDate(message.createdAt)}</div>
                  </article>
                ))}
              </div>
              <Form onSubmit={handleSendMessage} className="chat-composer">
                <Form.Control
                  as="textarea"
                  rows={3}
                  className="chat-form-input chat-composer-input"
                  value={messageDraft}
                  onChange={event => setMessageDraft(event.target.value)}
                  placeholder={intl.formatMessage({
                    id: 'chat.message.placeholder',
                    defaultMessage: 'Write a message',
                  })}
                  disabled={!canSend}
                />
                <div className="chat-composer-actions">
                  {!canSend && (
                    <span className="chat-composer-hint">
                      <FormattedMessage
                        id="chat.sender.notParticipant"
                        defaultMessage="Choose one of the profiles already in this conversation to send messages."
                      />
                    </span>
                  )}
                  <Button className="chat-action-button" type="submit" disabled={!canSend || !messageDraft.trim()}>
                    <FormattedMessage id="chat.sendButton" defaultMessage="Send" />
                  </Button>
                </div>
              </Form>
            </div>
          )}
        </section>
      </div>
    </Container>
  );
}
