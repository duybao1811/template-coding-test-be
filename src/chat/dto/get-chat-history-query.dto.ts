import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import {
  DEFAULT_CHAT_HISTORY_LIMIT,
  MAX_CHAT_HISTORY_LIMIT,
} from '../../constants';

export class GetChatHistoryQueryDto {
  @IsOptional()
  @IsString()
  beforeMessageId?: string;

  @IsOptional()
  @Transform(({ value }) => {
    const parsed = parseInt(value, 10);
    return Number.isNaN(parsed) ? DEFAULT_CHAT_HISTORY_LIMIT : parsed;
  })
  @IsInt()
  @Min(1)
  @Max(MAX_CHAT_HISTORY_LIMIT)
  limit: number = DEFAULT_CHAT_HISTORY_LIMIT;
}
