import type { ChatConversationDetails, ChatMessage } from "./chatTypes";

export const chatMessageKey = (message: ChatMessage) =>
  `MESSAGE#${message.createdAt}#${message.id}`;

/** Merge one bounded page without losing loaded history or replacing its
 * backwards cursor with the cursor for a fresh/newer page. */
export function mergeThreadPage(
  current: ChatConversationDetails,
  page: ChatConversationDetails,
): ChatConversationDetails {
  const byId = new Map(
    current.messages.map((message) => [message.id, message]),
  );
  page.messages.forEach((message) => byId.set(message.id, message));
  const messages = Array.from(byId.values()).sort((a, b) =>
    chatMessageKey(a).localeCompare(chatMessageKey(b)),
  );
  const receipts = new Map(
    (current.readReceipts || []).map((receipt) => [receipt.profileId, receipt]),
  );
  (page.readReceipts || []).forEach((receipt) => {
    const previous = receipts.get(receipt.profileId);
    if (
      !previous ||
      (receipt.readThroughKey || "") >= (previous.readThroughKey || "")
    )
      receipts.set(receipt.profileId, receipt);
  });
  return {
    ...page,
    messages,
    ...(receipts.size ? { readReceipts: Array.from(receipts.values()) } : {}),
    hasMoreMessages: current.hasMoreMessages,
    nextToken: current.nextToken,
    refreshToken: page.refreshToken || current.refreshToken,
  };
}

export function receiptReaders(
  message: ChatMessage,
  conversation: ChatConversationDetails,
): string[] {
  return conversation.readReceipts
    ? conversation.readReceipts
        .filter(
          (receipt) =>
            receipt.profileId === message.senderProfileId ||
            (receipt.readThroughKey || "") >= chatMessageKey(message),
        )
        .map((receipt) => receipt.profileId)
    : message.readByProfileIds || [message.senderProfileId];
}
