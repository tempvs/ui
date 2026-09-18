export type ChatParticipant = {
  profileId: string;
  name: string;
  type: string;
};

export type ChatMessage = {
  id: string;
  senderProfileId: string;
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
  senderProfileId: string;
  participantProfileIds: string[];
  title?: string | null;
  initialMessage?: string | null;
};

export type SendChatMessagePayload = {
  senderProfileId: string;
  text: string;
};
