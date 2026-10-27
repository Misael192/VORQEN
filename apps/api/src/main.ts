import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { env } from './config/env';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Sem isso, POST /projects/:id/files com Content-Type application/json
  // retorna 415 (Unsupported Media Type) no NestJS 10.
  app.useBodyParser('json', { limit: '5mb' });

  await app.listen(env.PORT, '0.0.0.0');
  console.log(`VORQEN API running on http://localhost:${env.PORT}`);
}

bootstrap();
