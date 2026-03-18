import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MessageAttachmentEntity } from './entities/message-attachment.entity';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AttachmentService {
  constructor(
    @InjectRepository(MessageAttachmentEntity)
    private readonly attachmentRepo: Repository<MessageAttachmentEntity>,
    private readonly configService: ConfigService,
  ) {}

  async saveAttachments(
    messageId: string,
    files: Express.Multer.File[],
  ): Promise<MessageAttachmentEntity[]> {
    if (!files?.length) {
      return [];
    }

    const attachments = files.map((file) =>
      this.attachmentRepo.create({
        messageId,
        type: 'image',
        originalName: file.originalname,
        filename: file.filename,
        mimeType: file.mimetype,
        size: file.size,
        localPath: file.path,
        url: `${this.configService.get<string>('app.baseUrl')}/uploads/chat-images/${file.filename}`,
        openaiFileId: null,
      }),
    );

    return await this.attachmentRepo.save(attachments);
  }

  async findByMessageId(messageId: string): Promise<MessageAttachmentEntity[]> {
    return await this.attachmentRepo.find({
      where: { messageId },
      order: { createdAt: 'ASC' },
    });
  }
}