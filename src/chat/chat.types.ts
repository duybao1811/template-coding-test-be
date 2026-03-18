import { MessageEntity } from './entities/message.entity';

export type StreamMeta = {
  conversationId: string;
  messageId: string;
};

export type StreamChatResult = {
  sessionId: string;
  conversationId: string;
  userMessageId: string;
  assistantMessageId: string;
  content: string;
};

export type GetMessagesOptions = {
  beforeMessageId?: string;
  limit?: number;
};

export type PaginatedMessagesResult = {
  messages: MessageEntity[];
  hasMore: boolean;
  nextCursor: string | null;
};