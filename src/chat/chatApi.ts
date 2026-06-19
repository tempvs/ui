import {
  ChatConversationDetails,
  ChatConversationSummary,
  CreateChatConversationPayload,
  SendChatMessagePayload,
} from './chatTypes';

type RequestOptions = RequestInit & {
  headers?: HeadersInit;
};

async function requestJson<T>(url: string, options: RequestOptions = {}) {
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
    const error = new Error(typeof data === 'string' ? data : `Request failed with status ${response.status}`) as Error & {
      status?: number;
      data?: unknown;
    };
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data as T;
}

export function listConversations(profileId: number, page = 0, size = 30) {
  return requestJson<ChatConversationSummary[]>(`/api/chat/conversations?profileId=${profileId}&page=${page}&size=${size}`);
}

export function getConversation(conversationId: number | string, profileId: number, page = 0, size = 40) {
  return requestJson<ChatConversationDetails>(`/api/chat/conversations/${conversationId}?profileId=${profileId}&page=${page}&size=${size}`);
}

export function createConversation(payload: CreateChatConversationPayload) {
  return requestJson<ChatConversationDetails>('/api/chat/conversations', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function sendMessage(conversationId: number | string, payload: SendChatMessagePayload) {
  return requestJson<ChatConversationDetails>(`/api/chat/conversations/${conversationId}/messages`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
