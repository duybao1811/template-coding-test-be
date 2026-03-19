import {
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
  DEFAULT_CHATGPT_MODEL,
  MAX_CHAT_HISTORY_LIMIT,
} from '../constants';
import {
  GetMessagesOptions,
  MessageResponseDto,
  MessageRole,
  OpenAIInputItem,
  OpenAIMessageInput,
  PaginatedMessagesResult,
  StreamChatResult,
} from './chat.types';
import { MessageAttachmentEntity } from '../attachment/entities/message-attachment.entity';
import { AttachmentService } from '../attachment/attachment.service';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly openai: OpenAI;

  constructor(
    @InjectRepository(ConversationEntity)
    private readonly conversationRepo: Repository<ConversationEntity>,

    @InjectRepository(MessageEntity)
    private readonly messageRepo: Repository<MessageEntity>,

    @InjectRepository(MessageAttachmentEntity)
    private readonly attachmentRepo: Repository<MessageAttachmentEntity>,

    private readonly configService: ConfigService,
    private readonly attachmentService: AttachmentService,
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

  private buildAttachmentUrl(url?: string | null): string | null {
    if (!url) return null;

    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }

    const appUrl = this.configService.get<string>('app.baseUrl');

    return `${appUrl}${url.startsWith('/') ? url : `/${url}`}`;
  }

  private toMessageResponseDto(message: MessageEntity): MessageResponseDto {
    return {
      id: message.id,
      role: message.role,
      content: message.content,
      createdAt: message.createdAt,
      conversationId: message.conversationId,
      attachments: (message.attachments || []).map((attachment) => ({
        id: attachment.id,
        url: this.buildAttachmentUrl(attachment.url),
      })),
    };
  }

  async getConversationMessages(
    conversationId: string,
    options?: GetMessagesOptions,
  ): Promise<MessageResponseDto[] | PaginatedMessagesResult> {
    if (!options) {
      const messages = await this.messageRepo.find({
        where: { conversationId },
        relations: {
          attachments: true,
        },
        order: { createdAt: 'ASC', id: 'ASC' },
      });
      return messages.map((message) => this.toMessageResponseDto(message));
    }

    const take = this.normalizeLimit(options.limit);

    if (!options.beforeMessageId) {
      const rows = await this.messageRepo.find({
        where: { conversationId },
        relations: {
          attachments: true,
        },
        order: { createdAt: 'DESC', id: 'DESC' },
        take: take + 1,
      });

      const hasMore = rows.length > take;
      const sliced = rows.slice(0, take);
      const messages = sliced
        .reverse()
        .map((message) => this.toMessageResponseDto(message));

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
      .leftJoinAndSelect('message.attachments', 'attachments')
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
    const messages = sliced
      .reverse()
      .map((message) => this.toMessageResponseDto(message));

    return {
      messages,
      hasMore,
      nextCursor: messages.length > 0 ? messages[0].id : null,
    };
  }

  async getMessagesBySessionId(
    sessionId: string,
    options?: GetMessagesOptions,
  ): Promise<MessageResponseDto[] | PaginatedMessagesResult> {
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

  private buildCurrentUserInput(
    message: string,
    attachments: MessageAttachmentEntity[],
  ): OpenAIMessageInput {
    const content: OpenAIInputItem[] = [];
    if (message?.trim()) {
      content.push({
        type: 'input_text',
        text: message.trim(),
      });
    }

    for (const attachment of attachments) {
      if (!attachment.openaiFileId) continue;

      content.push({
        type: 'input_image',
        file_id: attachment.openaiFileId,
      });
    }

    return {
      role: 'user',
      content,
    };
  }

  async streamChat(
    dto: CreateChatDto,
    files: Express.Multer.File[],
    onChunk: (chunk: string) => void,
    isAborted?: () => boolean,
  ): Promise<StreamChatResult> {
    const { sessionId, message } = dto;

    const conversation = await this.findOrCreateConversation(sessionId);

    const userMessage = await this.saveUserMessage(conversation.id, message);

    let attachments: MessageAttachmentEntity[] = [];
    if (files?.length) {
      attachments = await this.attachmentService.saveAttachments(
        userMessage.id,
        files,
      );
    }

    const history = await this.messageRepo.find({
      where: { conversationId: conversation.id },
      order: { createdAt: 'ASC', id: 'ASC' },
    });

    const previousHistory = history.filter((m) => m.id !== userMessage.id);

    const historyInput = previousHistory.map((msg) => ({
      role: msg.role as MessageRole,
      content: msg.content,
    }));
    const currentUserInput = this.buildCurrentUserInput(message, attachments);

    const input = [...historyInput, currentUserInput];

    const model =
      this.configService.get<string>('openai.model', DEFAULT_CHATGPT_MODEL) ??
      DEFAULT_CHATGPT_MODEL;

    let fullResponse = '';
    let openaiResponseId: string | null = null;
    let promptTokens = 0;
    let completionTokens = 0;

    try {
      const stream = await this.openai.responses.create({
        model,
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
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
