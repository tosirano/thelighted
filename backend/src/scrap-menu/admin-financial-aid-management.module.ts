import { Module } from '@nestjs/common';
import { AdminFinancialAidManagementController } from './admin-financial-aid-management.controller';
import { AdminFinancialAidManagementService } from './admin-financial-aid-management.service';

@Module({
  controllers: [AdminFinancialAidManagementController],
  providers: [AdminFinancialAidManagementService],
})
export class AdminFinancialAidManagementModule {}
