import { MessageEntity } from './entities/message.entity';

export type MessageRole = 'user' | 'assistant' | 'system';

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
  messages: MessageResponseDto[];
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
  role: MessageRole;
  content: string | OpenAIInputItem[];
};

export class MessageResponseDto {
  id: string;
  role: string;
  content: string;
  conversationId: string;
  createdAt: Date;
  attachments: {
    id: string;
    url: string | null;
  }[];
}
