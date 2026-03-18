import { MessageEntity } from './entities/message.entity';

export type MessageRole = 'user' | 'assistant' | 'system';

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

export type OpenAIInputTextItem = {
  type: 'input_text';
  text: string;
};

export type OpenAIInputItem = OpenAIInputTextItem | OpenAIInputImageItem;

export type OpenAIInputImageItem = {
  type: 'input_image';
  file_id: string;
};

export type OpenAIMessageInput = {
  role: 'user' | 'assistant' | 'system';
  content: string | OpenAIInputItem[];
}