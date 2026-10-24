import { Controller, Get, HttpException, HttpStatus, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Controller('api/v1')
export class HealthController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Get('health')
  async health() {
    const startedAt = Date.now();

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      const latencyMs = Date.now() - startedAt;

      return {
        status: 'ok',
        db: 'ok',
        latencyMs,
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          db: 'down',
          message: 'Database health check failed',
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }
}
