// backend/src/modules/auth/auth.service.ts
import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AdminUser, AdminRole } from './admin-user.entity';
import { LoginDto, RegisterAdminDto, ChangePasswordDto } from './auth.dto';
import { UpdateRegisterAdminDto } from './update-auth.dto';
import { ErrorCatch } from 'src/errorCatch.util';
import { Restaurant } from '../restaurant/restaurant.entity';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(AdminUser)
    private readonly adminUserRepository: Repository<AdminUser>,
    private readonly jwtService: JwtService,
    @InjectRepository(Restaurant)
    private readonly restaurantRepository: Repository<Restaurant>,
    private readonly dataSource: DataSource,
  ) {}

  async login(loginDto: LoginDto) {
    const admin = await this.adminUserRepository.findOne({
      where: { username: loginDto.username },
      relations: ['restaurant'],
    });

    if (!admin || !(await admin.validatePassword(loginDto.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!admin.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    // Check if restaurant exists and is active
    if (!admin.restaurant || !admin.restaurant.isActive) {
      throw new UnauthorizedException('Restaurant account is deactivated');
    }

    // Update last login
    admin.lastLoginAt = new Date();
    await this.adminUserRepository.save(admin);

    const payload = {
      sub: admin.id,
      username: admin.username,
      role: admin.role,
      restaurantId: admin.restaurantId,
    };

    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: admin.id,
        username: admin.username,
        email: admin.email,
        role: admin.role,
        lastLoginAt: admin.lastLoginAt,
        createdAt: admin.createdAt,
        isActive: admin.isActive,
        restaurantId: admin.restaurantId,
        restaurantName: admin.restaurant.name,
        restaurantSlug: admin.restaurant.slug,
      },
    };
  }

  async register(registerAdminDto: RegisterAdminDto) {
    // Check if username already exists
    const existingUsername = await this.adminUserRepository.findOne({
      where: { username: registerAdminDto.username },
    });

    if (existingUsername) {
      throw new ConflictException('Username already exists');
    }

    // Check if email already exists
    const existingEmail = await this.adminUserRepository.findOne({
      where: { email: registerAdminDto.email },
    });

    if (existingEmail) {
      throw new ConflictException('Email already exists');
    }

    // Create slug from restaurant name
    const slug = registerAdminDto.restaurantName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    // Check if restaurant slug already exists
    const existingRestaurant = await this.restaurantRepository.findOne({
      where: { slug },
    });

    if (existingRestaurant) {
      throw new ConflictException(
        'A restaurant with this name already exists. Please choose a different name.',
      );
    }

    // Use transaction to ensure restaurant + admin are created atomically
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Create restaurant first
      const restaurant = this.restaurantRepository.create({
        name: registerAdminDto.restaurantName,
        slug,
        phone: registerAdminDto.restaurantPhone,
        email: registerAdminDto.restaurantEmail,
        whatsappNumber: registerAdminDto.restaurantPhone,
      });

      await queryRunner.manager.save(restaurant);

      // Create admin user with SUPER_ADMIN role and link to restaurant
      const admin = this.adminUserRepository.create({
        username: registerAdminDto.username,
        email: registerAdminDto.email,
        passwordHash: registerAdminDto.password, // Will be hashed by @BeforeInsert
        role: AdminRole.SUPER_ADMIN,
        restaurantId: restaurant.id,
      });

      await queryRunner.manager.save(admin);

      await queryRunner.commitTransaction();

      const payload = {
        sub: admin.id,
        username: admin.username,
        role: admin.role,
        restaurantId: restaurant.id,
      };

      return {
        accessToken: this.jwtService.sign(payload),
        user: {
          id: admin.id,
          username: admin.username,
          email: admin.email,
          role: admin.role,
          lastLoginAt: admin.lastLoginAt,
          createdAt: admin.createdAt,
          isActive: admin.isActive,
          restaurantId: restaurant.id,
          restaurantName: restaurant.name,
          restaurantSlug: restaurant.slug,
        },
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async changePassword(
    userId: string,
    changePasswordDto: ChangePasswordDto,
    restaurantId: string,
  ) {
    const admin = await this.adminUserRepository.findOne({
      where: { id: userId, restaurantId },
    });

    if (!admin) {
      throw new NotFoundException('User not found');
    }

    const isValid = await admin.validatePassword(
      changePasswordDto.currentPassword,
    );
    if (!isValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    admin.passwordHash = changePasswordDto.newPassword; // Will be hashed by @BeforeUpdate
    await this.adminUserRepository.save(admin);

    return { message: 'Password changed successfully' };
  }

  async validateUser(
    userId: string,
    restaurantId: string,
  ): Promise<AdminUser | null> {
    return await this.adminUserRepository.findOne({
      where: { id: userId, isActive: true, restaurantId },
    });
  }

  async updateUserProfile(
    id: string,
    updateUserDto: UpdateRegisterAdminDto,
    restaurantId: string,
  ) {
    try {
      const existingUser = await this.adminUserRepository.findOne({
        where: { id, restaurantId },
      });

      if (!existingUser) {
        throw new NotFoundException('User not found');
      }

      const userToUpdate = await this.adminUserRepository.preload({
        id: id,
        ...updateUserDto,
      });

      if (!userToUpdate) {
        throw new NotFoundException('User not found');
      }

      const updatedUser = await this.adminUserRepository.save(userToUpdate);

      return {
        user: {
          id: updatedUser.id,
          username: updatedUser.username,
          email: updatedUser.email,
        },
      };
    } catch (error) {
      ErrorCatch(error, 'Failed to update user');
    }
  }
}
