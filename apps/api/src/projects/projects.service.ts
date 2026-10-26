import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { ProjectFileInputDto } from './dto/save-files.dto';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(ownerId: string, dto: CreateProjectDto) {
    return this.prisma.project.create({
      data: { ownerId, name: dto.name.trim(), description: dto.description ?? null },
    });
  }

  async listByOwner(ownerId: string) {
    return this.prisma.project.findMany({
      where: { ownerId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  /** Garante que o projeto existe e pertence ao usuário autenticado. */
  async assertOwnership(projectId: string, ownerId: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });

    if (!project) {
      throw new NotFoundException('Projeto não encontrado.');
    }
    if (project.ownerId !== ownerId) {
      throw new ForbiddenException('Você não tem acesso a este projeto.');
    }

    return project;
  }

  async getProject(projectId: string, ownerId: string) {
    await this.assertOwnership(projectId, ownerId);

    return this.prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      include: { files: { orderBy: { path: 'asc' } }, messages: { orderBy: { createdAt: 'asc' } } },
    });
  }

  /**
   * Upsert transacional de arquivos por (projectId, path), conforme arquitetura.
   * Somente caminhos relativos seguros são aceitos (validados no DTO).
   */
  async saveFiles(projectId: string, ownerId: string, files: ProjectFileInputDto[]) {
    await this.assertOwnership(projectId, ownerId);

    const operations: Prisma.PrismaPromise<unknown>[] = files.map((file) =>
      this.prisma.projectFile.upsert({
        where: {
          projectId_path: { projectId, path: file.path },
        },
        update: { content: file.content },
        create: { projectId, path: file.path, content: file.content },
      }),
    );

    await this.prisma.$transaction([
      ...operations,
      this.prisma.project.update({ where: { id: projectId }, data: { updatedAt: new Date() } }),
    ]);

    return this.prisma.projectFile.findMany({ where: { projectId }, orderBy: { path: 'asc' } });
  }

  async saveChatMessage(
    projectId: string,
    ownerId: string,
    message: { role: 'user' | 'assistant' | 'system'; content: string },
  ) {
    await this.assertOwnership(projectId, ownerId);

    return this.prisma.chatMessage.create({
      data: { projectId, role: message.role, content: message.content },
    });
  }
}
