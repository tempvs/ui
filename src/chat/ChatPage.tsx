import React, { FormEvent, useEffect, useState } from 'react';
import { Alert, Badge, Button, Container, Form, Modal, Spinner } from 'react-bootstrap';
import { useNavigate, useParams } from 'react-router-dom';
import { FormattedMessage, useIntl } from 'react-intl';
import { FaPlus } from 'react-icons/fa';

import SectionHeaderBar from '../component/SectionHeaderBar';
import { resolveCurrentOwnedProfileId } from '../profile/currentProfile';
import { fetchClubProfiles, fetchCurrentUserInfo, fetchUserProfileByUserId, searchProfiles } from '../profile/profileApi';
import { Profile } from '../profile/profileTypes';
import { createConversation, getConversation, listConversations, sendMessage } from './chatApi';
import { ChatConversationDetails, ChatConversationSummary } from './chatTypes';

type IconProps = {
  className?: string;
};

const PlusIcon = FaPlus as React.ComponentType<IconProps>;

function buildProfileLabel(profile: Profile | null | undefined) {
  if (!profile) {
    return '';
  }
  const fullName = `${profile.firstName || ''} ${profile.lastName || ''}`.trim();
  return fullName || profile.alias || `Profile ${profile.id}`;
}

function buildProfileMeta(profile: Profile | null | undefined) {
  if (!profile) {
    return '';
  }

  const alias = (profile.alias || '').trim();
  const email = (profile.profileEmail || '').trim();

  if (alias && email) {
    return `@${alias} • ${email}`;
  }

  if (alias) {
    return `@${alias}`;
  }

  return email;
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

function deduplicateProfilesByUser(profiles: Profile[], excludedUserId?: number | null) {
  const seenUserIds = new Set<number>();

  return profiles.filter(profile => {
    const profileId = Number(profile.id);
    if (!Number.isFinite(profileId)) {
      return false;
    }

    const userId = profile.userId != null ? Number(profile.userId) : null;
    if (userId != null && Number.isFinite(userId)) {
      if (excludedUserId != null && userId === excludedUserId) {
        return false;
      }

      if (seenUserIds.has(userId)) {
        return false;
      }

      seenUserIds.add(userId);
    }

    return true;
  });
}

function conversationIncludesProfile(
  conversation: Pick<ChatConversationSummary, 'participants'> | Pick<ChatConversationDetails, 'participants'>,
  profileId: number
) {
  return conversation.participants.some(participant => participant.profileId === profileId);
}

export default function ChatPage() {
  const intl = useIntl();
  const navigate = useNavigate();
  const { conversationId } = useParams();

  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [currentProfileId, setCurrentProfileId] = useState<number | null>(null);
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
  const [initialMessage, setInitialMessage] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [signedOut, setSignedOut] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);

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
        const currentProfileId = resolveCurrentOwnedProfileId(profiles);
        setCurrentProfileId(currentProfileId);
        setSelectedSenderId(prev => {
          if (prev && profiles.some(profile => Number(profile.id) === prev)) {
            return prev;
          }
          if (currentProfileId != null && profiles.some(profile => Number(profile.id) === currentProfileId)) {
            return currentProfileId;
          }
          return null;
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
    if (!senderProfiles.length || currentProfileId == null) {
      setConversations([]);
      setLoadingConversations(false);
      return;
    }

    let cancelled = false;
    const resolvedCurrentProfileId = currentProfileId;

    async function loadConversationsList() {
      setLoadingConversations(true);
      try {
        const data = await listConversations(resolvedCurrentProfileId);
        if (!cancelled) {
          const visibleConversations = (Array.isArray(data) ? data : [])
            .filter(conversation => conversationIncludesProfile(conversation, resolvedCurrentProfileId));
          setConversations(visibleConversations);
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
  }, [currentProfileId, senderProfiles, intl]);

  useEffect(() => {
    if (!conversationId || currentProfileId == null) {
      setSelectedConversation(null);
      setLoadingConversation(false);
      return;
    }

    let cancelled = false;
    const resolvedConversationId = conversationId;
    const resolvedCurrentProfileId = currentProfileId;

    async function loadConversationDetails() {
      setLoadingConversation(true);
      setFeedback(null);
      try {
        const data = await getConversation(resolvedConversationId, resolvedCurrentProfileId);
        if (cancelled) {
          return;
        }
        if (!conversationIncludesProfile(data, resolvedCurrentProfileId)) {
          setSelectedConversation(null);
          setFeedback(intl.formatMessage({
            id: 'chat.conversation.failed',
            defaultMessage: 'Unable to open that conversation.',
          }));
          navigate('/chat', { replace: true });
          return;
        }
        setSelectedConversation(data);
        setSelectedSenderId(prev => {
          if (prev && data.participants.some(participant => participant.profileId === prev)) {
            return prev;
          }
          const currentParticipant = data.participants.find(participant => participant.profileId === resolvedCurrentProfileId);
          if (currentParticipant) {
            return resolvedCurrentProfileId;
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
          navigate('/chat', { replace: true });
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
  }, [conversationId, currentProfileId, senderProfiles, intl, navigate]);

  useEffect(() => {
    if (!createModalVisible) {
      return;
    }

    const query = participantQuery.trim();
    if (!query) {
      setParticipantResults([]);
      setParticipantLoading(false);
      return;
    }

    let cancelled = false;
    setParticipantLoading(true);

    const timeoutId = window.setTimeout(async () => {
      try {
        const results = await searchProfiles({ query, size: 12 });
        if (!cancelled) {
          const selectedUserIds = new Set(
            selectedParticipants
              .map(profile => profile.userId != null ? Number(profile.userId) : null)
              .filter((userId): userId is number => userId != null && Number.isFinite(userId))
          );

          const filteredResults = deduplicateProfilesByUser(results, currentUserId)
            .filter(profile => Number(profile.id) !== selectedSenderId)
            .filter(profile => {
              const userId = profile.userId != null ? Number(profile.userId) : null;
              return userId == null || !selectedUserIds.has(userId);
            });

          setParticipantResults(filteredResults);
        }
      } catch (error) {
        if (!cancelled) {
          setFeedback(intl.formatMessage({
            id: 'chat.participantSearch.failed',
            defaultMessage: 'Unable to search profiles right now.',
          }));
        }
      } finally {
        if (!cancelled) {
          setParticipantLoading(false);
        }
      }
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [createModalVisible, currentUserId, intl, participantQuery, selectedParticipants, selectedSenderId]);

  async function refreshConversations(selectedId?: number) {
    if (currentProfileId == null) {
      setConversations([]);
      if (selectedId != null) {
        navigate('/chat');
      }
      return;
    }

    const data = await listConversations(currentProfileId);
    const visibleConversations = (Array.isArray(data) ? data : [])
      .filter(conversation => conversationIncludesProfile(conversation, currentProfileId));
    setConversations(visibleConversations);

    if (selectedId != null) {
      navigate(`/chat/${selectedId}`);
    }
  }

  async function handleCreateConversation(event: FormEvent) {
    event.preventDefault();
    if (currentProfileId == null) {
      return;
    }
    if (!initialMessage.trim()) {
      setFeedback(intl.formatMessage({
        id: 'chat.initialMessage.required',
        defaultMessage: 'Write the first message before creating a conversation.',
      }));
      return;
    }

    const participantIds = selectedParticipants
      .map(profile => Number(profile.id))
      .filter(profileId => profileId !== currentProfileId);

    if (!participantIds.length) {
      setFeedback(intl.formatMessage({
        id: 'chat.participants.required',
        defaultMessage: 'Choose at least one participant.',
      }));
      return;
    }

    try {
      const details = await createConversation({
        senderProfileId: currentProfileId,
        participantProfileIds: participantIds,
        title: participantIds.length > 1 ? groupTitle.trim() || null : null,
        initialMessage: initialMessage.trim(),
      });
      setSelectedParticipants([]);
      setParticipantResults([]);
      setParticipantQuery('');
      setGroupTitle('');
      setInitialMessage('');
      setCreateModalVisible(false);
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
    setParticipantQuery('');
    setParticipantResults([]);
  }

  function removeParticipant(profileId: number) {
    setSelectedParticipants(current => current.filter(profile => Number(profile.id) !== profileId));
  }

  function resetCreateConversationState() {
    setParticipantQuery('');
    setParticipantResults([]);
    setSelectedParticipants([]);
    setGroupTitle('');
    setInitialMessage('');
    setParticipantLoading(false);
  }

  function openCreateConversationModal() {
    resetCreateConversationState();
    setFeedback(null);
    setCreateModalVisible(true);
  }

  function closeCreateConversationModal() {
    setCreateModalVisible(false);
    resetCreateConversationState();
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
  const noCurrentProfile = !loadingProfiles && currentProfileId == null;
  const currentProfile = senderProfiles.find(profile => Number(profile.id) === currentProfileId) || null;
  const currentProfileName = buildProfileLabel(currentProfile);
  const canCreateConversation = !loadingProfiles && Boolean(initialMessage.trim());

  return (
    <Container fluid className="chat-shell px-3 px-xl-4 py-3 py-xl-4">
      <div className="chat-page-grid">
        <aside className="chat-sidebar-panel">
          <SectionHeaderBar
            title={intl.formatMessage({ id: 'chat.title', defaultMessage: 'Chat' })}
            subtitle={null}
            rightContent={(
              <Button type="button" className="chat-create-trigger" onClick={openCreateConversationModal} disabled={noCurrentProfile}>
                <PlusIcon /> <FormattedMessage id="chat.createButton" defaultMessage="New conversation" />
              </Button>
            )}
          />
          {feedback && <Alert variant="warning" className="chat-feedback">{feedback}</Alert>}
          <div className="chat-list-panel mt-3">
            <div className="chat-panel-heading">
              <FormattedMessage id="chat.conversations" defaultMessage="Conversations" />
            </div>
            {loadingConversations && <Spinner animation="border" size="sm" />}
            {noCurrentProfile && (
              <div className="chat-empty-state">
                <FormattedMessage
                  id="chat.currentProfile.required"
                  defaultMessage="Choose or create a current profile to use chat."
                />
              </div>
            )}
            {!loadingConversations && !noCurrentProfile && conversations.length === 0 && (
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
          {noCurrentProfile && !conversationId && (
            <div className="chat-empty-workspace">
              <h2 className="chat-workspace-title">
                <FormattedMessage id="chat.profileRequired.title" defaultMessage="Choose a current profile" />
              </h2>
              <p className="chat-workspace-copy">
                <FormattedMessage
                  id="chat.profileRequired.copy"
                  defaultMessage="Chat is scoped to the current profile. Pick one from the header to see conversations."
                />
              </p>
            </div>
          )}
          {!conversationId && !noCurrentProfile && (
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
          {conversationId && !noCurrentProfile && loadingConversation && (
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
      <Modal show={createModalVisible} onHide={closeCreateConversationModal} centered dialogClassName="chat-create-dialog">
        <Modal.Header closeButton className="chat-create-modal-header">
          <div className="chat-create-modal-title-block">
            <span className="chat-create-modal-kicker">
              <FormattedMessage id="chat.newConversation" defaultMessage="New conversation" />
            </span>
            <Modal.Title className="chat-create-modal-title">
              {currentProfileName ? `As ${currentProfileName}` : 'As current profile'}
            </Modal.Title>
          </div>
        </Modal.Header>
        <Modal.Body className="chat-create-modal-body">
          <Form onSubmit={handleCreateConversation} className="chat-create-form">
            <Form.Group className="chat-form-group">
              <Form.Label className="chat-form-label">
                <FormattedMessage id="chat.participantSearch" defaultMessage="Find participants" />
              </Form.Label>
              <div className="chat-participant-search-shell">
                <Form.Control
                  className="chat-form-input"
                  value={participantQuery}
                  onChange={event => {
                    setParticipantQuery(event.target.value);
                    setFeedback(null);
                  }}
                  placeholder={intl.formatMessage({
                    id: 'chat.participantSearch.placeholder',
                    defaultMessage: 'Search profiles by name or alias',
                  })}
                />
                {participantQuery.trim() && (
                  <div className="chat-search-popover">
                    {participantLoading && (
                      <div className="chat-search-popover-status">
                        <Spinner animation="border" size="sm" />
                      </div>
                    )}
                    {!participantLoading && participantResults.length === 0 && (
                      <div className="chat-search-popover-empty">
                        <FormattedMessage id="chat.participantSearch.empty" defaultMessage="No matching profiles." />
                      </div>
                    )}
                    {!participantLoading && participantResults.length > 0 && (
                      <div className="chat-search-results">
                        {participantResults.map(profile => (
                          <button
                            key={profile.id}
                            type="button"
                            className="chat-search-result"
                            onClick={() => addParticipant(profile)}
                          >
                            <span className="chat-search-result-copy">
                              <span className="chat-search-result-name">{buildProfileLabel(profile)}</span>
                              {buildProfileMeta(profile) && (
                                <span className="chat-search-result-meta">{buildProfileMeta(profile)}</span>
                              )}
                            </span>
                            <Badge bg="light" text="dark">{profile.type || 'PROFILE'}</Badge>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Form.Group>
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
            <Form.Group className="chat-form-group">
              <Form.Label className="chat-form-label">
                <FormattedMessage id="chat.initialMessage" defaultMessage="Message" />
              </Form.Label>
              <Form.Control
                as="textarea"
                rows={4}
                className="chat-form-input"
                value={initialMessage}
                onChange={event => setInitialMessage(event.target.value)}
                placeholder={intl.formatMessage({
                  id: 'chat.initialMessage.placeholder',
                  defaultMessage: 'Write the first message',
                })}
              />
            </Form.Group>
            <div className="chat-create-actions">
              <Button type="button" className="chat-secondary-button" onClick={closeCreateConversationModal}>
                <FormattedMessage id="profile.action.cancel" defaultMessage="Cancel" />
              </Button>
              <Button className="chat-action-button" type="submit" disabled={!canCreateConversation}>
                <FormattedMessage id="chat.sendButton" defaultMessage="Send" />
              </Button>
            </div>
          </Form>
        </Modal.Body>
      </Modal>
    </Container>
  );
}
