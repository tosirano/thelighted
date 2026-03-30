import { Module } from '@nestjs/common';
import { AboutManagementController } from './about-management.controller';
import { AboutManagementService } from './about-management.service';

@Module({
  controllers: [AboutManagementController],
  providers: [AboutManagementService],
})
export class AboutManagementModule {}
