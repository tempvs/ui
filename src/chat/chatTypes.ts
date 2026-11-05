import type { PublicMapReference } from "../map/MapReferenceAttachment";

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
  mapReference?: PublicMapReference;
  references?: import("../component/entityReferences").EntityReference[];
  isRead?: boolean;
  readByProfileIds?: string[];
};

export type ChatConversationSummary = {
  id: string;
  title?: string;
  type: "DIRECT" | "GROUP";
  displayName: string;
  previewText: string;
  updatedAt: string;
  participants: ChatParticipant[];
  unreadCount?: number;
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
  newerToken?: string;
  refreshToken?: string;
  firstUnreadMessageId?: string;
  readReceipts?: Array<{
    profileId: string;
    unreadCount: number;
    readThroughKey?: string;
  }>;
};

export type CreateChatConversationPayload = {
  senderProfileId: string;
  participantProfileIds: string[];
  title?: string | null;
  initialMessage?: string | null;
  references?: import("../component/entityReferences").EntityReference[];
  mapReference?: PublicMapReference;
};

export type SendChatMessagePayload = {
  senderProfileId: string;
  text: string;
  mapReference?: PublicMapReference;
  references?: import("../component/entityReferences").EntityReference[];
};
