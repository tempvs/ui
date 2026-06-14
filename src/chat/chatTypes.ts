export type ChatParticipant = {
  profileId: number;
  name: string;
  type?: string | null;
};

export type ChatMessage = {
  id: number;
  senderProfileId: number;
  senderName: string;
  text: string;
  createdAt?: string | null;
};

export type ChatConversationSummary = {
  id: number;
  title?: string | null;
  type?: 'DIRECT' | 'GROUP' | string | null;
  displayName: string;
  previewText?: string | null;
  updatedAt?: string | null;
  participants: ChatParticipant[];
};

export type ChatConversationDetails = {
  id: number;
  title?: string | null;
  type?: 'DIRECT' | 'GROUP' | string | null;
  displayName: string;
  updatedAt?: string | null;
  participants: ChatParticipant[];
  messages: ChatMessage[];
  hasMoreMessages: boolean;
};

export type CreateChatConversationPayload = {
  senderProfileId: number;
  participantProfileIds: number[];
  title?: string | null;
  initialMessage?: string | null;
};

export type SendChatMessagePayload = {
  senderProfileId: number;
  text: string;
};
