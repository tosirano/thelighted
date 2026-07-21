import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminUser } from './admin-user.entity';
import { TokenBlacklistService } from './token-blacklist.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @InjectRepository(AdminUser)
    private readonly adminUserRepository: Repository<AdminUser>,
    private readonly tokenBlacklistService: TokenBlacklistService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'your-secret-key',
    });
  }

  async validate(payload: any) {
    if (payload.jti) {
      const isBlacklisted =
        await this.tokenBlacklistService.isBlacklisted(payload.jti);
      if (isBlacklisted) {
        throw new UnauthorizedException('Token has been revoked');
      }
    }

    const admin = await this.adminUserRepository.findOne({
      where: { id: payload.sub },
      relations: ['restaurant'],
    });

    if (!admin || !admin.isActive) {
      throw new UnauthorizedException();
    }

    if (!admin.restaurant.isActive) {
      throw new UnauthorizedException('Restaurant account is deactivated');
    }

    return {
      id: admin.id,
      username: admin.username,
      email: admin.email,
      role: admin.role,
      restaurantId: admin.restaurantId,
      isActive: admin.isActive,
      createdAt: admin.createdAt,
      lastLoginAt: admin.lastLoginAt,
    };
  }
}
