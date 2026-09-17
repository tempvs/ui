import {
  ChatConversationDetails,
  ChatConversationPage,
  ChatConversationSummary,
  ChatMessage,
  ChatParticipant,
  CreateChatConversationPayload,
  SendChatMessagePayload,
} from './chatTypes';

type RequestOptions = RequestInit & { headers?: HeadersInit };
type ApiErrorPayload = { code?: unknown; message?: unknown; requestId?: unknown };

async function requestJson<T>(url: string, parse: (value: unknown) => T, options: RequestOptions = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text) as unknown;
    } catch {
      throw requestError(response.status, undefined, 'The chat service returned invalid JSON');
    }
  }
  if (!response.ok) {
    const payload = objectValue(data) as ApiErrorPayload | null;
    throw requestError(
      response.status,
      payload,
      typeof payload?.message === 'string' ? payload.message : `Request failed with status ${response.status}`,
    );
  }
  try {
    return parse(data);
  } catch {
    throw requestError(response.status, undefined, 'The chat service returned an invalid response');
  }
}

function requestError(status: number, data: unknown, message: string) {
  const error = new Error(message) as Error & { status?: number; data?: unknown };
  error.status = status;
  error.data = data;
  return error;
}

export function newIdempotencyKey() {
  return crypto.randomUUID();
}

export function activeProfileNotFoundId(error: unknown): number | null {
  if (!(error instanceof Error)) return null;
  const match = /^Active profile (\d+) not found$/.exec(error.message);
  if (!match) return null;
  const profileId = Number(match[1]);
  return Number.isSafeInteger(profileId) && profileId > 0 ? profileId : null;
}

export function listConversations(profileId: number, nextToken?: string, limit = 20) {
  const query = new URLSearchParams({ profileId: String(profileId), limit: String(limit) });
  if (nextToken) query.set('nextToken', nextToken);
  return requestJson(`/api/chat/conversations?${query}`, pageValue);
}

export function getConversation(
  conversationId: string,
  profileId: number,
  nextToken?: string,
  limit = 40,
) {
  const query = new URLSearchParams({ profileId: String(profileId), limit: String(limit) });
  if (nextToken) query.set('nextToken', nextToken);
  return requestJson(
    `/api/chat/conversations/${encodeURIComponent(conversationId)}?${query}`,
    conversationDetailsValue,
  );
}

export function createConversation(payload: CreateChatConversationPayload, idempotencyKey: string) {
  return requestJson('/api/chat/conversations', conversationDetailsValue, {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify(payload),
  });
}

export function sendMessage(
  conversationId: string,
  payload: SendChatMessagePayload,
  idempotencyKey: string,
) {
  return requestJson(
    `/api/chat/conversations/${encodeURIComponent(conversationId)}/messages`,
    conversationDetailsValue,
    {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify(payload),
    },
  );
}

function pageValue(value: unknown): ChatConversationPage {
  const page = requiredObject(value);
  if (!Array.isArray(page.content) || typeof page.hasMore !== 'boolean') throw new Error();
  const nextToken = optionalString(page.nextToken);
  return {
    content: page.content.map(conversationSummaryValue),
    hasMore: page.hasMore,
    ...(nextToken ? { nextToken } : {}),
  };
}

function conversationDetailsValue(value: unknown): ChatConversationDetails {
  const object = requiredObject(value);
  const summary = conversationSummaryValue(object);
  if (!Array.isArray(object.messages) || typeof object.hasMoreMessages !== 'boolean') throw new Error();
  const nextToken = optionalString(object.nextToken);
  return {
    ...summary,
    messages: object.messages.map(messageValue),
    hasMoreMessages: object.hasMoreMessages,
    ...(nextToken ? { nextToken } : {}),
  };
}

function conversationSummaryValue(value: unknown): ChatConversationSummary {
  const object = requiredObject(value);
  if (
    typeof object.id !== 'string' ||
    (object.type !== 'DIRECT' && object.type !== 'GROUP') ||
    typeof object.displayName !== 'string' ||
    typeof object.previewText !== 'string' ||
    typeof object.updatedAt !== 'string' ||
    !Array.isArray(object.participants)
  ) throw new Error();
  const title = optionalString(object.title);
  return {
    id: object.id,
    ...(title ? { title } : {}),
    type: object.type,
    displayName: object.displayName,
    previewText: object.previewText,
    updatedAt: object.updatedAt,
    participants: object.participants.map(participantValue),
  };
}

function participantValue(value: unknown): ChatParticipant {
  const object = requiredObject(value);
  if (!positiveInteger(object.profileId) || typeof object.name !== 'string' || typeof object.type !== 'string') {
    throw new Error();
  }
  return { profileId: object.profileId, name: object.name, type: object.type };
}

function messageValue(value: unknown): ChatMessage {
  const object = requiredObject(value);
  if (
    typeof object.id !== 'string' ||
    !positiveInteger(object.senderProfileId) ||
    typeof object.senderName !== 'string' ||
    typeof object.text !== 'string' ||
    typeof object.createdAt !== 'string'
  ) throw new Error();
  return {
    id: object.id,
    senderProfileId: object.senderProfileId,
    senderName: object.senderName,
    text: object.text,
    createdAt: object.createdAt,
  };
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function requiredObject(value: unknown): Record<string, unknown> {
  const object = objectValue(value);
  if (!object) throw new Error();
  return object;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function positiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}
