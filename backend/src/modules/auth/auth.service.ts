import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { AdminUser, AdminRole } from './admin-user.entity';
import { LoginDto, RegisterAdminDto, ChangePasswordDto } from './auth.dto';
import { UpdateRegisterAdminDto } from './update-auth.dto';
import { ErrorCatch } from 'src/errorCatch.util';
import { Restaurant } from '../restaurant/restaurant.entity';
import { TokenBlacklistService } from './token-blacklist.service';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(AdminUser)
    private readonly adminUserRepository: Repository<AdminUser>,
    private readonly jwtService: JwtService,
    @InjectRepository(Restaurant)
    private readonly restaurantRepository: Repository<Restaurant>,
    private readonly tokenBlacklistService: TokenBlacklistService,
  ) {}

  private parseExpiresIn(expiresIn: string): number {
    const match = expiresIn.match(/^(\d+)([smhd])$/);
    if (!match) return 86400;
    const value = parseInt(match[1], 10);
    const unit = match[2];
    switch (unit) {
      case 's':
        return value;
      case 'm':
        return value * 60;
      case 'h':
        return value * 3600;
      case 'd':
        return value * 86400;
      default:
        return 86400;
    }
  }

  private generateTokenPair(admin: AdminUser) {
    const jti = uuidv4();
    const refreshJti = uuidv4();

    const accessToken = this.jwtService.sign({
      sub: admin.id,
      username: admin.username,
      role: admin.role,
      restaurantId: admin.restaurantId,
      jti,
    });

    const refreshTokenSecret =
      process.env.REFRESH_TOKEN_SECRET || 'refresh-secret';
    const refreshTokenExpiresIn = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';
    const refreshTtl = this.parseExpiresIn(refreshTokenExpiresIn);

    const refreshToken = this.jwtService.sign(
      {
        sub: admin.id,
        type: 'refresh',
        jti: refreshJti,
      },
      {
        secret: refreshTokenSecret,
        expiresIn: refreshTtl,
      },
    );

    this.tokenBlacklistService.blacklistRefreshToken(refreshJti, refreshTtl);

    return { accessToken, refreshToken, accessJti: jti, refreshJti, refreshTtl };
  }

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

    if (!admin.restaurant.isActive) {
      throw new UnauthorizedException('Restaurant account is deactivated');
    }

    admin.lastLoginAt = new Date();
    await this.adminUserRepository.save(admin);

    const { accessToken, refreshToken } = this.generateTokenPair(admin);

    return {
      accessToken,
      refreshToken,
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
    const existingUsername = await this.adminUserRepository.findOne({
      where: { username: registerAdminDto.username },
    });

    if (existingUsername) {
      throw new ConflictException('Username already exists');
    }

    const existingEmail = await this.adminUserRepository.findOne({
      where: { email: registerAdminDto.email },
    });

    if (existingEmail) {
      throw new ConflictException('Email already exists');
    }

    const slug = registerAdminDto.restaurantName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    const existingRestaurant = await this.restaurantRepository.findOne({
      where: { slug },
    });

    if (existingRestaurant) {
      throw new ConflictException(
        'A restaurant with this name already exists. Please choose a different name.',
      );
    }

    const restaurant = this.restaurantRepository.create({
      name: registerAdminDto.restaurantName,
      slug,
      phone: registerAdminDto.restaurantPhone,
      email: registerAdminDto.restaurantEmail,
      whatsappNumber: registerAdminDto.restaurantPhone,
    });

    await this.restaurantRepository.save(restaurant);

    const admin = this.adminUserRepository.create({
      username: registerAdminDto.username,
      email: registerAdminDto.email,
      passwordHash: registerAdminDto.password,
      role: AdminRole.SUPER_ADMIN,
      restaurantId: restaurant.id,
    });

    await this.adminUserRepository.save(admin);

    const { accessToken, refreshToken } = this.generateTokenPair(admin);

    return {
      accessToken,
      refreshToken,
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
  }

  async refreshTokens(refreshToken: string) {
    const refreshTokenSecret =
      process.env.REFRESH_TOKEN_SECRET || 'refresh-secret';

    let payload: any;
    try {
      payload = this.jwtService.verify(refreshToken, {
        secret: refreshTokenSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid token type');
    }

    const isValid =
      await this.tokenBlacklistService.isRefreshTokenValid(payload.jti);
    if (!isValid) {
      throw new UnauthorizedException('Refresh token has been revoked');
    }

    await this.tokenBlacklistService.revokeRefreshToken(payload.jti);

    const admin = await this.adminUserRepository.findOne({
      where: { id: payload.sub },
      relations: ['restaurant'],
    });

    if (!admin || !admin.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    if (!admin.restaurant.isActive) {
      throw new UnauthorizedException('Restaurant account is deactivated');
    }

    const tokens = this.generateTokenPair(admin);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  async logout(user: any, accessToken?: string) {
    if (accessToken) {
      try {
        const decoded = this.jwtService.decode(accessToken);
        if (decoded && decoded.jti) {
          const expiresIn = decoded.exp
            ? decoded.exp - Math.floor(Date.now() / 1000)
            : 86400;
          if (expiresIn > 0) {
            await this.tokenBlacklistService.blacklistToken(
              decoded.jti,
              expiresIn,
            );
          }
        }
      } catch {}
    }

    return { message: 'Logged out successfully' };
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

    admin.passwordHash = changePasswordDto.newPassword;
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

      const finalUser = await this.adminUserRepository.findOne({
        where: { id: updatedUser.id },
      });

      return {
        user: {
          id: finalUser.id,
          username: finalUser.username,
          email: finalUser.email,
        },
      };
    } catch (error) {
      ErrorCatch(error, 'Failed to update user');
    }
  }
}
