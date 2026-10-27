import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma.service';

/**
 * E2E real contra o PostgreSQL definido em DATABASE_URL.
 * Se o banco nao estiver acessivel, a suite falha (sem mocks/simulacoes).
 */
describe('Auth + Projects (e2e)', () => {
  let app: INestApplication;
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `e2e-${suffix}@vorqen.test`;
  const password = 'senha-e2e-123456';
  let token = '';
  let projectId = '';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      const prisma = app.get(PrismaService);
      if (projectId) {
        await prisma.project.deleteMany({ where: { id: projectId } }).catch(() => undefined);
      }
      await prisma.user.deleteMany({ where: { email } }).catch(() => undefined);
      await app.close();
    }
  });

  it('/api/v1/health responde ok', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health').expect(200);
    expect(res.body.status).toBe('ok');
  });

  it('/api/v1/auth/register cria usuario e devolve JWT', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password })
      .expect(201);
    expect(res.body.user.email).toBe(email);
    expect(typeof res.body.token).toBe('string');
    token = res.body.token;
  });

  it('/api/v1/auth/login recusa senha errada com mensagem STE100', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'senha-errada-000' })
      .expect(401);
    expect(res.body.message).toBe('E-mail ou senha incorretos.');
  });

  it('/api/v1/auth/login aceita credenciais validas', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);
    expect(res.body.token).toBeTruthy();
  });

  it('/api/v1/projects exige autenticacao', async () => {
    await request(app.getHttpServer()).get('/api/v1/projects').expect(401);
  });

  it('fluxo completo: criar projeto -> salvar arquivos -> ler projeto', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Projeto E2E' })
      .expect(201);
    projectId = created.body.id;

    await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectId}/files`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        files: [
          { path: 'index.html', content: '<!doctype html><html><body><div id="root"></div></body></html>' },
          { path: 'src/App.tsx', content: 'export default function App() { return <h1>E2E</h1>; }' },
        ],
      })
      .expect(201);

    const loaded = await request(app.getHttpServer())
      .get(`/api/v1/projects/${projectId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(loaded.body.files).toHaveLength(2);
    expect(loaded.body.files[0].path).toBe('index.html');
  });

  it('/api/v1/auth/me retorna o usuario autenticado', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.email).toBe(email);
  });
});
