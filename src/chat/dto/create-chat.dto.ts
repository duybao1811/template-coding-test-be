import {
  ArrayMaxSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateChatDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  sessionId: string;

  @IsString()
  @MaxLength(10000)
  message: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  attachmentIds?: string[];
}
