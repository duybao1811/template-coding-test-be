import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ConversationEntity } from './entities/conversation.entity';
import { MessageEntity } from './entities/message.entity';
import { MessageAttachmentEntity } from '../attachment/entities/message-attachment.entity';
import { AttachmentService } from '../attachment/attachment.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ConversationEntity,
      MessageEntity,
      MessageAttachmentEntity,
    ]),
  ],
  controllers: [ChatController],
  providers: [ChatService, AttachmentService],
})
export class ChatModule {}
