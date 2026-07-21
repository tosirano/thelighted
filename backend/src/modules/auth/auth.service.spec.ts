import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { TokenBlacklistService } from './token-blacklist.service';

jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('mock-uuid-123'),
}));

describe('AuthService', () => {
  let service: AuthService;
  let jwtService: JwtService;
  let tokenBlacklistService: any;

  const mockAdminRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    preload: jest.fn(),
  };

  const mockRestaurantRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
  };

  beforeEach(() => {
    jwtService = {
      sign: jest.fn().mockReturnValue('mock-token'),
      verify: jest.fn(),
      decode: jest.fn(),
    } as any;

    tokenBlacklistService = {
      blacklistToken: jest.fn(),
      isBlacklisted: jest.fn().mockResolvedValue(false),
      blacklistRefreshToken: jest.fn(),
      isRefreshTokenValid: jest.fn().mockResolvedValue(true),
      revokeRefreshToken: jest.fn(),
    } as any;

    service = new AuthService(
      mockAdminRepository as any,
      jwtService,
      mockRestaurantRepository as any,
      tokenBlacklistService,
    );
  });

  describe('logout', () => {
    it('should blacklist the access token on logout', async () => {
      const mockUser = { id: '123', role: 'admin' };
      const mockToken = 'valid.jwt.token';

      jest.spyOn(jwtService, 'decode').mockReturnValue({
        jti: 'token-jti-123',
        exp: Math.floor(Date.now() / 1000) + 3600,
      });

      const result = await service.logout(mockUser, mockToken);

      expect(tokenBlacklistService.blacklistToken).toHaveBeenCalledWith(
        'token-jti-123',
        expect.any(Number),
      );
      expect(result).toEqual({ message: 'Logged out successfully' });
    });

    it('should handle logout without access token', async () => {
      const mockUser = { id: '123', role: 'admin' };

      const result = await service.logout(mockUser);

      expect(tokenBlacklistService.blacklistToken).not.toHaveBeenCalled();
      expect(result).toEqual({ message: 'Logged out successfully' });
    });
  });

  describe('refreshTokens', () => {
    it('should issue new tokens with valid refresh token', async () => {
      const mockAdmin = {
        id: '123',
        username: 'testuser',
        role: 'admin',
        restaurantId: 'rest-1',
        isActive: true,
        restaurant: { isActive: true, name: 'Test', slug: 'test' },
      };

      jest.spyOn(jwtService, 'verify').mockReturnValue({
        sub: '123',
        type: 'refresh',
        jti: 'refresh-jti-123',
      });

      mockAdminRepository.findOne.mockResolvedValue(mockAdmin);

      const result = await service.refreshTokens('valid-refresh-token');

      expect(tokenBlacklistService.isRefreshTokenValid).toHaveBeenCalledWith(
        'refresh-jti-123',
      );
      expect(tokenBlacklistService.revokeRefreshToken).toHaveBeenCalledWith(
        'refresh-jti-123',
      );
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });

    it('should reject invalid refresh token', async () => {
      jest.spyOn(jwtService, 'verify').mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(service.refreshTokens('invalid-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should reject revoked refresh token', async () => {
      jest.spyOn(jwtService, 'verify').mockReturnValue({
        sub: '123',
        type: 'refresh',
        jti: 'revoked-jti',
      });

      tokenBlacklistService.isRefreshTokenValid.mockResolvedValue(false);

      await expect(service.refreshTokens('revoked-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
