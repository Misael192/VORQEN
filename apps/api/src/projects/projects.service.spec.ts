import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ProjectsService } from './projects.service';

/** Mock mínimo do PrismaService — nenhum banco real é necessário no smoke test. */
function createPrismaMock() {
  return {
    project: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
    },
    projectFile: {
      upsert: jest.fn(),
      findMany: jest.fn(),
    },
    chatMessage: {
      create: jest.fn(),
    },
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  };
}

describe('ProjectsService', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let service: ProjectsService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new ProjectsService(prisma as never);
  });

  describe('create', () => {
    it('cria um projeto vinculado ao usuário autenticado (sem temp-user-id)', async () => {
      const ownerId = 'user-123';
      const created = { id: 'proj-1', ownerId, name: 'Meu App', description: null };
      prisma.project.create.mockResolvedValue(created);

      const result = await service.create(ownerId, { name: '  Meu App  ' });

      expect(prisma.project.create).toHaveBeenCalledWith({
        data: { ownerId, name: 'Meu App', description: null },
      });
      expect(result).toEqual(created);
    });
  });

  describe('assertOwnership', () => {
    it('lança NotFound quando o projeto não existe', async () => {
      prisma.project.findUnique.mockResolvedValue(null);
      await expect(service.assertOwnership('missing', 'user-123')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('lança Forbidden quando o projeto pertence a outro usuário', async () => {
      prisma.project.findUnique.mockResolvedValue({ id: 'p1', ownerId: 'outra-pessoa' });
      await expect(service.assertOwnership('p1', 'user-123')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('saveFiles', () => {
    it('faz upsert transacional por (projectId, path) após validar propriedade', async () => {
      prisma.project.findUnique.mockResolvedValue({ id: 'p1', ownerId: 'user-123' });
      prisma.projectFile.upsert.mockResolvedValue({ id: 'f1' });
      prisma.project.update.mockResolvedValue({ id: 'p1' });
      prisma.projectFile.findMany.mockResolvedValue([{ id: 'f1', path: 'src/App.tsx' }]);

      const files = [{ path: 'src/App.tsx', content: 'const A = 1;' }];
      const result = await service.saveFiles('p1', 'user-123', files);

      expect(prisma.projectFile.upsert).toHaveBeenCalledWith({
        where: { projectId_path: { projectId: 'p1', path: 'src/App.tsx' } },
        update: { content: 'const A = 1;' },
        create: { projectId: 'p1', path: 'src/App.tsx', content: 'const A = 1;' },
      });
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(result).toEqual([{ id: 'f1', path: 'src/App.tsx' }]);
    });

    it('recusa salvar arquivos de um projeto que não pertence ao usuário', async () => {
      prisma.project.findUnique.mockResolvedValue({ id: 'p1', ownerId: 'outra-pessoa' });

      await expect(service.saveFiles('p1', 'user-123', [{ path: 'a.ts', content: '' }])).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.projectFile.upsert).not.toHaveBeenCalled();
    });
  });
});
