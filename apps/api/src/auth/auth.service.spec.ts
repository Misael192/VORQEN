import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma.service';

describe('AuthService', () => {
  let service: AuthService;
  const prismaMock = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  };
  const jwtMock = { signAsync: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuthService(prismaMock as unknown as PrismaService, jwtMock as unknown as JwtService);
  });

  it('cadastro cria usuario com hash bcrypt e retorna token', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue({ id: 'u1', email: 'ana@vorqen.dev', createdAt: new Date() });
    jwtMock.signAsync.mockResolvedValue('jwt-token');

    const result = await service.register({ email: 'Ana@Vorqen.dev ', password: 'senha-forte-123' });

    expect(prismaMock.user.create).toHaveBeenCalledTimes(1);
    const data = prismaMock.user.create.mock.calls[0][0].data;
    expect(data.email).toBe('ana@vorqen.dev');
    expect(data.passwordHash).not.toBe('senha-forte-123');
    expect(await bcrypt.compare('senha-forte-123', data.passwordHash)).toBe(true);
    expect(result.token).toBe('jwt-token');
  });

  it('login falha com credencial errada', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    await expect(service.login({ email: 'x@y.z', password: 'qualquer' })).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('login bem-sucedido compara a senha com o hash', async () => {
    const hash = await bcrypt.hash('senha-forte-123', 10);
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'ana@vorqen.dev',
      passwordHash: hash,
      createdAt: new Date(),
    });
    jwtMock.signAsync.mockResolvedValue('jwt-token');

    const result = await service.login({ email: 'ana@vorqen.dev', password: 'senha-forte-123' });
    expect(result.user.id).toBe('u1');
    expect(result.user).not.toHaveProperty('passwordHash');
    expect(result.token).toBe('jwt-token');
  });
});
