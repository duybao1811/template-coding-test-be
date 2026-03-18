import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { MessageEntity } from '../../chat/entities/message.entity';

export type AttachmentType = 'image';

@Entity('message_attachments')
export class MessageAttachmentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'char', length: 36 })
  messageId: string;

  @ManyToOne(
    () => MessageEntity,
    (message: MessageEntity) => message.attachments,
    {
      onDelete: 'CASCADE',
    },
  )
  @JoinColumn({ name: 'messageId' })
  message: Relation<MessageEntity>;

  @Column({ type: 'varchar', length: 20 })
  type: AttachmentType;

  @Column({ type: 'varchar', length: 255 })
  originalName: string;

  @Column({ type: 'varchar', length: 255 })
  filename: string;

  @Column({ type: 'varchar', length: 255 })
  mimeType: string;

  @Column({ type: 'bigint' })
  size: number;

  @Column({ type: 'varchar', length: 500 })
  localPath: string;

  @Column({ type: 'varchar', length: 500 })
  url: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  openaiFileId: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
