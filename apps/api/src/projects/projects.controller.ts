import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { SaveFilesDto } from './dto/save-files.dto';
import { SaveChatMessageDto } from './dto/save-chat-message.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';

/**
 * Nenhuma rota deste controller executa inferência ou fala com Ollama/OpenAI/Anthropic.
 * A IA é 100% client-side (ver packages/ai-core); aqui apenas persistimos os resultados.
 */
@UseGuards(JwtAuthGuard)
@Controller('api/v1/projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateProjectDto) {
    return this.projects.create(user.sub, dto);
  }

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.projects.listByOwner(user.sub);
  }

  @Get(':id')
  getOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.projects.getProject(id, user.sub);
  }

  @Post(':id/files')
  saveFiles(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: SaveFilesDto) {
    return this.projects.saveFiles(id, user.sub, dto.files);
  }

  @Post(':id/messages')
  saveMessage(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: SaveChatMessageDto,
  ) {
    return this.projects.saveChatMessage(id, user.sub, { role: dto.role, content: dto.content });
  }
}
