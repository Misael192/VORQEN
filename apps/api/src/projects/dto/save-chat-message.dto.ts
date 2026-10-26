import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';

export class SaveChatMessageDto {
  @IsIn(['user', 'assistant', 'system'], { message: 'Papel da mensagem inválido.' })
  role!: 'user' | 'assistant' | 'system';

  @IsString()
  @MinLength(1, { message: 'A mensagem não pode ser vazia.' })
  @MaxLength(50_000)
  content!: string;
}
