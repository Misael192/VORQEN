import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { SaveFilesDto } from './dto/save-files.dto';

interface SnapshotFile {
  path: string;
  content: string;
}

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateProjectDto) {
    const project = await this.prisma.project.create({
      data: { ownerId: userId, name: dto.name, description: dto.description ?? null },
    });
    return this.toSummary(project);
  }

  async findAll(userId: string) {
    const projects = await this.prisma.project.findMany({
      where: { ownerId: userId },
      orderBy: { updatedAt: 'desc' },
      include: { versions: { take: 1, orderBy: { createdAt: 'desc' } } },
    });
    return projects.map((p) => ({
      ...this.toSummary(p),
      hasFiles: (p.versions[0]?.snapshotJson as { files?: SnapshotFile[] } | null)?.files?.length
        ? true
        : false,
    }));
  }

  async findOne(userId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, ownerId: userId },
      include: { versions: { take: 1, orderBy: { createdAt: 'desc' } } },
    });
    if (!project) {
      throw new NotFoundException('Projeto nao encontrado ou sem acesso.');
    }

    const snapshot = project.versions[0]?.snapshotJson as { files?: SnapshotFile[] } | null;
    return {
      ...this.toSummary(project),
      files: Array.isArray(snapshot?.files) ? snapshot!.files : [],
    };
  }

  async saveFiles(userId: string, projectId: string, dto: SaveFilesDto) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, ownerId: userId },
    });
    if (!project) {
      throw new NotFoundException('Projeto nao encontrado ou sem acesso.');
    }

    const files: SnapshotFile[] = dto.files.map((f) => ({
      path: f.path.replace(/^\/+/, ''),
      content: f.content,
    }));

    const version = await this.prisma.$transaction(async (tx) => {
      const created = await tx.projectVersion.create({
        data: { projectId: project.id, snapshotJson: { files } },
      });
      await tx.project.update({
        where: { id: project.id },
        data: dto.name ? { name: dto.name, updatedAt: new Date() } : { updatedAt: new Date() },
      });
      return created;
    });

    return { ok: true, versionId: version.id, savedAt: version.createdAt, fileCount: files.length };
  }

  private toSummary(project: { id: string; name: string; description: string | null; createdAt: Date; updatedAt: Date }) {
    return {
      id: project.id,
      name: project.name,
      description: project.description,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    };
  }
}
