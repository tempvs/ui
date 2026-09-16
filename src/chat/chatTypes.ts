export type ChatParticipant = {
  profileId: number;
  name: string;
  type: string;
};

export type ChatMessage = {
  id: string;
  senderProfileId: number;
  senderName: string;
  text: string;
  createdAt: string;
};

export type ChatConversationSummary = {
  id: string;
  title?: string;
  type: 'DIRECT' | 'GROUP';
  displayName: string;
  previewText: string;
  updatedAt: string;
  participants: ChatParticipant[];
};

export type ChatConversationPage = {
  content: ChatConversationSummary[];
  hasMore: boolean;
  nextToken?: string;
};

export type ChatConversationDetails = ChatConversationSummary & {
  messages: ChatMessage[];
  hasMoreMessages: boolean;
  nextToken?: string;
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

