import { IsEmail, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8, 'A senha deve ter no minimo 8 caracteres.')
  password!: string;
}
