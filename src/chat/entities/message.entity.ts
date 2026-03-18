import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  OneToMany,
} from 'typeorm';

import type { Relation } from 'typeorm';
import { ConversationEntity } from './conversation.entity';
import { MessageAttachmentEntity } from './message-attachment.entity';

export type MessageRole = 'user' | 'assistant';

@Entity('messages')
export class MessageEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'varchar', length: 36 })
  conversationId!: string;

  @ManyToOne(
    () => ConversationEntity,
    (conversation: ConversationEntity) => conversation.messages,
    {
      onDelete: 'CASCADE',
    },
  )
  @JoinColumn({ name: 'conversationId' })
  conversation!: Relation<ConversationEntity>;

  @Column({
    type: 'enum',
    enum: ['user', 'assistant'],
  })
  role!: MessageRole;

  @Column({ type: 'longtext' })
  content!: string;

  @Column({ type: 'int', default: 0 })
  promptTokens!: number;

  @Column({ type: 'int', default: 0 })
  completionTokens!: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  model!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  openaiResponseId!: string | null;

  @OneToMany(
    () => MessageAttachmentEntity,
    (attachment: MessageAttachmentEntity) => attachment.message,
  )
  attachments: Relation<MessageAttachmentEntity[]>;

  @CreateDateColumn()
  createdAt!: Date;
}
