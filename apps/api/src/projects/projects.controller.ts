import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser, RequestUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateProjectDto } from './dto/create-project.dto';
import { SaveFilesDto } from './dto/save-files.dto';
import { ProjectsService } from './projects.service';

@Controller('api/v1/projects')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateProjectDto) {
    return this.projects.create(user.id, dto);
  }

  @Get()
  findAll(@CurrentUser() user: RequestUser) {
    return this.projects.findAll(user.id);
  }

  @Get(':id')
  findOne(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.projects.findOne(user.id, id);
  }

  @Post(':id/files')
  saveFiles(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: SaveFilesDto,
  ) {
    return this.projects.saveFiles(user.id, id, dto);
  }
}
