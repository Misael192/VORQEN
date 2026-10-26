import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';

const SAFE_RELATIVE_PATH = /^(?!(?:\/|[A-Za-z]:))(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._\-@ ]+(?:\/[A-Za-z0-9._\-@ ]+)*$/;

export class ProjectFileInputDto {
  @IsString()
  @Matches(SAFE_RELATIVE_PATH, {
    message: 'O caminho do arquivo deve ser relativo e não pode conter "..".',
  })
  path!: string;

  @IsString()
  @MaxLength(200_000, { message: 'Conteúdo do arquivo excede o limite de 200KB.' })
  content!: string;
}

export class SaveFilesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMaxSize(100, { message: 'Máximo de 100 arquivos por requisição.' })
  @Type(() => ProjectFileInputDto)
  files!: ProjectFileInputDto[];
}
