import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateChatDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  sessionId: string;

  @IsString()
  @MaxLength(10000)
  message: string;
}
