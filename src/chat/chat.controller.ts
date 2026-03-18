import { Body, Controller, Get, Param, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';

import { ChatService } from './chat.service';
import { CreateChatDto } from './dto/create-chat.dto';
import { GetChatHistoryQueryDto } from './dto/get-chat-history-query.dto';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('stream')
  async streamChat(@Body() dto: CreateChatDto, @Res() res: Response) {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    let isClosed = false;

    res.on('close', () => {
      isClosed = true;
    });

    try {
      const result = await this.chatService.streamChat(
        dto,
        (chunk: string) => {
          if (isClosed) {
            return;
          }

          res.write(
            `data: ${JSON.stringify({
              type: 'chunk',
              content: chunk,
            })}\n\n`,
          );
        },
        (meta) => {
          if (isClosed) {
            return;
          }

          res.write(`data: ${JSON.stringify({ type: 'meta', ...meta })}\n\n`);
        },
        () => isClosed,
      );

      if (!isClosed) {
        res.write(
          `data: ${JSON.stringify({
            type: 'done',
            sessionId: result.sessionId,
            conversationId: result.conversationId,
          })}\n\n`,
        );
        res.end();
      }
    } catch (error: unknown) {
      if (!isClosed) {
        const message =
          error instanceof Error ? error.message : 'Internal server error';

        res.write(
          `data: ${JSON.stringify({
            type: 'error',
            message,
          })}\n\n`,
        );
        res.end();
      }
    }
  }

  @Get('history/:sessionId')
  async getHistory(
    @Param('sessionId') sessionId: string,
    @Query() query: GetChatHistoryQueryDto,
  ) {
    const { beforeMessageId, limit } = query;

    if (beforeMessageId || limit) {
      const result = await this.chatService.getMessagesBySessionId(sessionId, {
        beforeMessageId,
        limit,
      });

      return {
        sessionId,
        ...result,
      };
    }

    const messages = await this.chatService.getMessagesBySessionId(sessionId);

    return {
      sessionId,
      messages,
    };
  }
}
