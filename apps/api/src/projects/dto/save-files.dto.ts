import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';

export class ProjectFileDto {
  @IsString()
  @IsNotEmpty()
  // Caminho relativo seguro: sem "..", sem caminho absoluto.
  @Matches(/^(?!\.\.?[\\/])(?!\/)[\w.@\-\\/]+$/, {
    message: 'Caminho de arquivo invalido: use caminhos relativos sem "..".',
  })
  path!: string;

  @IsString()
  content!: string;
}

export class SaveFilesDto {
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => ProjectFileDto)
  files!: ProjectFileDto[];

  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;
}
