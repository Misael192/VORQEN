import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { HealthController } from './health/health.controller';
import { ProjectsModule } from './projects/projects.module';
import { PrismaService } from './prisma.service';

@Module({
  imports: [AuthModule, ProjectsModule],
  controllers: [HealthController],
  providers: [PrismaService],
})
export class AppModule {}
