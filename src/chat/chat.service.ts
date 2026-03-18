import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Brackets, Repository } from 'typeorm';
import OpenAI from 'openai';

import { ConversationEntity } from './entities/conversation.entity';
import { MessageEntity } from './entities/message.entity';
import { CreateChatDto } from './dto/create-chat.dto';
import {
  DEFAULT_CHAT_HISTORY_LIMIT,
  MAX_CHAT_HISTORY_LIMIT,
} from '../constants';
import type {
  GetMessagesOptions,
  PaginatedMessagesResult,
  StreamChatResult,
  StreamMeta,
} from './chat.types';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly openai: OpenAI;

  constructor(
    @InjectRepository(ConversationEntity)
    private readonly conversationRepo: Repository<ConversationEntity>,
    @InjectRepository(MessageEntity)
    private readonly messageRepo: Repository<MessageEntity>,
    private readonly configService: ConfigService,
  ) {
    const apiKey = this.configService.get<string>('openai.apiKey');

    if (!apiKey) {
      throw new Error('Missing OpenAI API key: openai.apiKey');
    }

    this.openai = new OpenAI({ apiKey });
  }

  async findOrCreateConversation(
    sessionId: string,
  ): Promise<ConversationEntity> {
    let conversation = await this.conversationRepo.findOne({
      where: { sessionId },
    });

    if (!conversation) {
      conversation = this.conversationRepo.create({
        sessionId,
        title: null,
      });

      conversation = await this.conversationRepo.save(conversation);
    }

    return conversation;
  }

  async saveUserMessage(
    conversationId: string,
    content: string,
  ): Promise<MessageEntity> {
    const message = this.messageRepo.create({
      conversationId,
      role: 'user',
      content,
      model: null,
      openaiResponseId: null,
      promptTokens: 0,
      completionTokens: 0,
    });

    return await this.messageRepo.save(message);
  }

  async saveAssistantMessage(params: {
    conversationId: string;
    content: string;
    model: string;
    openaiResponseId: string | null;
    promptTokens: number;
    completionTokens: number;
  }): Promise<MessageEntity> {
    const message = this.messageRepo.create({
      conversationId: params.conversationId,
      role: 'assistant',
      content: params.content,
      model: params.model,
      openaiResponseId: params.openaiResponseId,
      promptTokens: params.promptTokens,
      completionTokens: params.completionTokens,
    });

    return await this.messageRepo.save(message);
  }

  private normalizeLimit(limit?: number): number {
    if (!limit || Number.isNaN(limit)) {
      return DEFAULT_CHAT_HISTORY_LIMIT;
    }

    return Math.max(1, Math.min(limit, MAX_CHAT_HISTORY_LIMIT));
  }

  async getConversationMessages(
    conversationId: string,
  ): Promise<MessageEntity[]>;
  async getConversationMessages(
    conversationId: string,
    options: GetMessagesOptions,
  ): Promise<PaginatedMessagesResult>;
  async getConversationMessages(
    conversationId: string,
    options?: GetMessagesOptions,
  ): Promise<MessageEntity[] | PaginatedMessagesResult> {
    if (!options) {
      return await this.messageRepo.find({
        where: { conversationId },
        order: { createdAt: 'ASC', id: 'ASC' as never },
      });
    }

    const take = this.normalizeLimit(options.limit);

    if (!options.beforeMessageId) {
      const rows = await this.messageRepo.find({
        where: { conversationId },
        order: { createdAt: 'DESC', id: 'DESC' as never },
        take: take + 1,
      });

      const hasMore = rows.length > take;
      const sliced = rows.slice(0, take);
      const messages = sliced.reverse();

      return {
        messages,
        hasMore,
        nextCursor: messages.length > 0 ? messages[0].id : null,
      };
    }

    const cursorMessage = await this.messageRepo.findOne({
      where: {
        id: options.beforeMessageId,
        conversationId,
      },
    });

    if (!cursorMessage) {
      return {
        messages: [],
        hasMore: false,
        nextCursor: null,
      };
    }

    const rows = await this.messageRepo
      .createQueryBuilder('message')
      .where('message.conversationId = :conversationId', { conversationId })
      .andWhere(
        new Brackets((qb) => {
          qb.where('message.createdAt < :cursorCreatedAt', {
            cursorCreatedAt: cursorMessage.createdAt,
          }).orWhere(
            '(message.createdAt = :cursorCreatedAt AND message.id < :cursorId)',
            {
              cursorCreatedAt: cursorMessage.createdAt,
              cursorId: cursorMessage.id,
            },
          );
        }),
      )
      .orderBy('message.createdAt', 'DESC')
      .addOrderBy('message.id', 'DESC')
      .take(take + 1)
      .getMany();

    const hasMore = rows.length > take;
    const sliced = rows.slice(0, take);
    const messages = sliced.reverse();

    return {
      messages,
      hasMore,
      nextCursor: messages.length > 0 ? messages[0].id : null,
    };
  }

  async getMessagesBySessionId(sessionId: string): Promise<MessageEntity[]>;
  async getMessagesBySessionId(
    sessionId: string,
    options: GetMessagesOptions,
  ): Promise<PaginatedMessagesResult>;
  async getMessagesBySessionId(
    sessionId: string,
    options?: GetMessagesOptions,
  ): Promise<MessageEntity[] | PaginatedMessagesResult> {
    const conversation = await this.conversationRepo.findOne({
      where: { sessionId },
    });

    if (!conversation) {
      if (!options) {
        return [];
      }

      return {
        messages: [],
        hasMore: false,
        nextCursor: null,
      };
    }

    if (!options) {
      return await this.getConversationMessages(conversation.id);
    }

    return await this.getConversationMessages(conversation.id, options);
  }

  buildOpenAIInput(
    history: MessageEntity[],
  ): Array<{ role: 'user' | 'assistant' | 'system'; content: string }> {
    return history.map((msg) => ({
      role: msg.role as 'user' | 'assistant' | 'system',
      content: msg.content,
    }));
  }

  async streamChat(
    dto: CreateChatDto,
    onChunk: (chunk: string) => void,
    onMeta?: (meta: StreamMeta) => void,
    isAborted?: () => boolean,
  ): Promise<StreamChatResult> {
    const { sessionId, message } = dto;

    if (!sessionId?.trim()) {
      throw new BadRequestException('sessionId is required');
    }

    if (!message?.trim()) {
      throw new BadRequestException('message is required');
    }

    const conversation = await this.findOrCreateConversation(sessionId);

    const userMessage = await this.saveUserMessage(conversation.id, message);

    if (onMeta) {
      onMeta({
        conversationId: conversation.id,
        messageId: userMessage.id,
      });
    }

    const history = await this.getConversationMessages(conversation.id);
    const input = this.buildOpenAIInput(history);

    const model =
      this.configService.get<string>('openai.model', 'gpt-5.4') ?? 'gpt-5.4';

    let fullResponse = '';
    let openaiResponseId: string | null = null;
    let promptTokens = 0;
    let completionTokens = 0;

    try {
      const stream = await this.openai.responses.create({
        model,
        input,
        stream: true,
      });

      for await (const event of stream) {
        if (isAborted?.()) {
          break;
        }
        if (event.type === 'response.output_text.delta') {
          const delta = event.delta ?? '';
          if (delta) {
            fullResponse += delta;
            onChunk(delta);
          }
        }

        if (event.type === 'response.completed') {
          openaiResponseId = event.response?.id ?? null;
          promptTokens = event.response?.usage?.input_tokens ?? 0;
          completionTokens = event.response?.usage?.output_tokens ?? 0;
        }
      }
    } catch (error) {
      this.logger.error('OpenAI streaming failed', error);

      throw new InternalServerErrorException('Failed to generate AI response');
    }

    const assistantMessage = await this.saveAssistantMessage({
      conversationId: conversation.id,
      content: fullResponse,
      model,
      openaiResponseId,
      promptTokens,
      completionTokens,
    });

    if (!conversation.title) {
      await this.conversationRepo.update(conversation.id, {
        title: message.slice(0, 50),
      });
    }

    return {
      sessionId,
      conversationId: conversation.id,
      userMessageId: userMessage.id,
      assistantMessageId: assistantMessage.id,
      content: fullResponse,
    };
  }
}
