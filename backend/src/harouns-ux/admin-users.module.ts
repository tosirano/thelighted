// #83 – Backend — Admin Users Module
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from '../modules/admin/admin.controller';
import { AdminService } from '../modules/admin/admin.service';
import { AuditLog } from '../modules/admin/audit-log.entity';
import { AdminUser } from './admin-user.entity';
import { MenuItem } from '../modules/menu/menu-item.entity';
import { ContactSubmission } from '../modules/contact/contact-submission.entity';
import { AnalyticsEvent } from '../modules/analytics/analytics-event.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AdminUser,
      AuditLog,
      MenuItem,
      ContactSubmission,
      AnalyticsEvent
    ])
  ],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService]
})
export class AdminUsersModule {}
