import {
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MessageAttachmentEntity } from './entities/message-attachment.entity';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import * as fs from 'node:fs';
import * as path from 'node:path';

@Injectable()
export class AttachmentService {
  private readonly openai: OpenAI;

  constructor(
    @InjectRepository(MessageAttachmentEntity)
    private readonly attachmentRepo: Repository<MessageAttachmentEntity>,
    private readonly configService: ConfigService,
  ) {
    const apiKey = this.configService.get<string>('openai.apiKey');

    if (!apiKey) {
      throw new Error('Missing OpenAI API key: openai.apiKey');
    }

    this.openai = new OpenAI({ apiKey });
  }

  private resolvePath(filePath: string): string {
    return path.isAbsolute(filePath)
      ? filePath
      : path.join(process.cwd(), filePath);
  }

  private async uploadOpenAIFile(file: Express.Multer.File): Promise<string> {
    const uploaded = await this.openai.files.create({
      file: fs.createReadStream(this.resolvePath(file.path)),
      purpose: 'vision',
    });

    return uploaded.id;
  }

  async saveAttachments(
    messageId: string,
    files: Express.Multer.File[],
  ): Promise<MessageAttachmentEntity[]> {
    if (!files?.length) {
      return [];
    }

    const attachments: MessageAttachmentEntity[] = [];

    for (const file of files) {
      const openaiFileId = await this.uploadOpenAIFile(file);

      const attachment = this.attachmentRepo.create({
        messageId,
        type: 'image',
        originalName: file.originalname,
        filename: file.filename,
        mimeType: file.mimetype,
        size: file.size,
        localPath: file.path,
        url: `${this.configService.get<string>('app.baseUrl')}/uploads/chat-images/${file.filename}`,
        openaiFileId,
      });

      attachments.push(await this.attachmentRepo.save(attachment));
    }

    return attachments;
  }
}
