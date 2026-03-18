import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import type { Response } from 'express';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ChatService } from './chat.service';
import { CreateChatDto } from './dto/create-chat.dto';
import { GetChatHistoryQueryDto } from './dto/get-chat-history-query.dto';
import { AttachmentService } from '../attachment/attachment.service';
import { multerConfig } from '../common/config/multer.config';

@Controller('chat')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly attachmentService: AttachmentService,
  ) {}

  @Post('stream')
  @UseInterceptors(FilesInterceptor('images', 20, multerConfig))
  async streamChat(
    @Body() dto: CreateChatDto,
    @UploadedFiles() files: Express.Multer.File[],
    @Res() res: Response,
  ) {
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
        files,
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
