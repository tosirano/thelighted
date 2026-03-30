// backend/src/modules/admin/admin.service.ts
import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './audit-log.entity';
import { AdminUser, AdminRole } from '../auth/admin-user.entity';
import { MenuItem } from '../menu/menu-item.entity';
import {
  ContactSubmission,
  ContactStatus,
} from '../contact/contact-submission.entity';
import { AnalyticsEvent } from '../analytics/analytics-event.entity';
import { CreateUserDto } from './create-user.dto';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
    @InjectRepository(AdminUser)
    private readonly adminUserRepository: Repository<AdminUser>,
    @InjectRepository(MenuItem)
    private readonly menuItemRepository: Repository<MenuItem>,
    @InjectRepository(ContactSubmission)
    private readonly contactRepository: Repository<ContactSubmission>,
    @InjectRepository(AnalyticsEvent)
    private readonly analyticsRepository: Repository<AnalyticsEvent>,
  ) {}

  /**
   * Create a new user within the restaurant
   * Only SUPER_ADMIN can create users
   */
  async createUser(
    createUserDto: CreateUserDto,
    restaurantId: string,
    creatorRole: AdminRole,
  ) {
    // Only SUPER_ADMIN can create users
    if (creatorRole !== AdminRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only super admin can create users');
    }

    // Prevent creating another SUPER_ADMIN
    if (createUserDto.role === AdminRole.SUPER_ADMIN) {
      throw new ForbiddenException('Cannot create another super admin');
    }

    // Check if username already exists in this restaurant
    const existingUsername = await this.adminUserRepository.findOne({
      where: {
        username: createUserDto.username,
        restaurantId,
      },
    });

    if (existingUsername) {
      throw new ConflictException('Username already exists in your restaurant');
    }

    // Check if email already exists in this restaurant
    const existingEmail = await this.adminUserRepository.findOne({
      where: {
        email: createUserDto.email,
        restaurantId,
      },
    });

    if (existingEmail) {
      throw new ConflictException('Email already exists in your restaurant');
    }

    // Create the user
    const user = this.adminUserRepository.create({
      username: createUserDto.username,
      email: createUserDto.email,
      passwordHash: createUserDto.password, // Will be hashed by @BeforeInsert
      role: createUserDto.role,
      restaurantId,
    });

    await this.adminUserRepository.save(user);

    return {
      message: 'User created successfully',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
        restaurantId: restaurantId,
      },
    };
  }

  async getAllAdmins(restaurantId: string) {
    const admins = await this.adminUserRepository.find({
      where: { restaurantId },
      select: [
        'id',
        'username',
        'email',
        'role',
        'isActive',
        'lastLoginAt',
        'createdAt',
      ],
      order: { createdAt: 'DESC' },
    });

    // Map lastLoginAt to lastLogin for frontend compatibility
    return admins.map((admin) => ({
      ...admin,
      lastLogin: admin.lastLoginAt,
    }));
  }

  async toggleAdminStatus(
    adminId: string,
    restaurantId: string,
    isActive: boolean,
    requesterId: string,
    requesterRole: AdminRole,
  ) {
    // Only SUPER_ADMIN can toggle status
    if (requesterRole !== AdminRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only super admin can toggle user status');
    }

    // Find user in this restaurant
    const admin = await this.adminUserRepository.findOne({
      where: { id: adminId, restaurantId }, // ADD restaurantId filter
    });

    if (!admin) {
      throw new BadRequestException('Admin not found');
    }

    // Prevent toggling own status
    if (admin.id === requesterId) {
      throw new ForbiddenException('Cannot toggle your own status');
    }

    // Prevent toggling SUPER_ADMIN status
    if (admin.role === AdminRole.SUPER_ADMIN) {
      throw new ForbiddenException('Cannot toggle super admin status');
    }

    await this.adminUserRepository.update(adminId, { isActive });
    return { message: 'Admin status updated successfully' };
  }

  // UPDATE EXISTING METHOD - Add restaurantId filtering
  async updateAdminRole(
    adminId: string,
    restaurantId: string,
    role: string,
    requesterId: string,
    requesterRole: AdminRole,
  ) {
    // Only SUPER_ADMIN can update roles
    if (requesterRole !== AdminRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only super admin can update roles');
    }

    // Validate role
    if (!Object.values(AdminRole).includes(role as AdminRole)) {
      throw new BadRequestException('Invalid role');
    }

    // Prevent assigning SUPER_ADMIN role
    if (role === AdminRole.SUPER_ADMIN) {
      throw new ForbiddenException('Cannot assign super admin role');
    }

    // Find admin in this restaurant
    const admin = await this.adminUserRepository.findOne({
      where: { id: adminId, restaurantId },
    });

    if (!admin) {
      throw new BadRequestException('Admin not found');
    }

    // Prevent changing SUPER_ADMIN role
    if (admin.role === AdminRole.SUPER_ADMIN) {
      throw new ForbiddenException('Cannot change Super Admin role');
    }

    // Prevent changing own role
    if (admin.id === requesterId) {
      throw new ForbiddenException('Cannot change your own role');
    }

    await this.adminUserRepository.update(adminId, { role: role as AdminRole });
    return { message: 'Admin role updated successfully' };
  }

  // UPDATE EXISTING METHOD - Add restaurantId filtering
  async getDashboardStats(restaurantId: string) {
    const totalMenuItems = await this.menuItemRepository.count({
      where: { restaurantId }, // ADD THIS
    });

    const availableItems = await this.menuItemRepository.count({
      where: { isAvailable: true, restaurantId }, // ADD restaurantId
    });

    const newContacts = await this.contactRepository.count({
      where: { status: ContactStatus.NEW, restaurantId }, // ADD restaurantId
    });

    const totalContacts = await this.contactRepository.count({
      where: { restaurantId }, // ADD THIS
    });

    // Get analytics for last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentAnalytics = await this.analyticsRepository
      .createQueryBuilder('event')
      .select('COUNT(*)', 'count')
      .where('event.timestamp >= :date', { date: sevenDaysAgo })
      .andWhere('event.restaurantId = :restaurantId', { restaurantId }) // ADD THIS
      .getRawOne();

    // Get most popular items
    const popularItems = await this.menuItemRepository.find({
      where: { restaurantId }, // ADD THIS
      order: { clickCount: 'DESC' },
      take: 5,
    });

    return {
      menu: {
        total: totalMenuItems,
        available: availableItems,
        unavailable: totalMenuItems - availableItems,
      },
      contacts: {
        total: totalContacts,
        new: newContacts,
        read: totalContacts - newContacts,
      },
      analytics: {
        last7Days: parseInt(recentAnalytics.count, 10) || 0,
      },
      popularItems: popularItems.map((item) => ({
        id: item.id,
        name: item.name,
        clicks: item.clickCount,
      })),
    };
  }

  // UPDATE EXISTING METHOD - Add restaurantId filtering
  async getAuditLogs(restaurantId: string, limit: number = 50) {
    return await this.auditLogRepository.find({
      where: { restaurantId }, // ADD THIS (make sure AuditLog entity has restaurantId)
      relations: ['admin'],
      order: { timestamp: 'DESC' },
      take: limit,
    });
  }

  // UPDATE EXISTING METHOD - Add restaurantId filtering
  async logAction(
    adminId: string,
    restaurantId: string, // ADD THIS PARAMETER
    action: string,
    entityType: string,
    entityId?: string,
    details?: Record<string, any>,
  ) {
    const log = this.auditLogRepository.create({
      adminId,
      restaurantId, // ADD THIS
      action,
      entityType,
      entityId,
      details,
    });
    await this.auditLogRepository.save(log);
  }
}
