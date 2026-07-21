import { ExecutionContext } from '@nestjs/common';
import { TokenBlacklistService } from './token-blacklist.service';

describe('TokenBlacklistService', () => {
  let service: TokenBlacklistService;

  beforeEach(() => {
    service = new TokenBlacklistService();
  });

  describe('blacklistToken', () => {
    it('should be callable without error when not connected', async () => {
      await expect(
        service.blacklistToken('test-jti', 3600),
      ).resolves.toBeUndefined();
    });
  });

  describe('isBlacklisted', () => {
    it('should return false when not connected', async () => {
      const result = await service.isBlacklisted('test-jti');
      expect(result).toBe(false);
    });
  });

  describe('blacklistRefreshToken', () => {
    it('should be callable without error when not connected', async () => {
      await expect(
        service.blacklistRefreshToken('test-rt-jti', 604800),
      ).resolves.toBeUndefined();
    });
  });

  describe('isRefreshTokenValid', () => {
    it('should return true when not connected (fail-open)', async () => {
      const result = await service.isRefreshTokenValid('test-rt-jti');
      expect(result).toBe(true);
    });
  });

  describe('revokeRefreshToken', () => {
    it('should be callable without error when not connected', async () => {
      await expect(
        service.revokeRefreshToken('test-rt-jti'),
      ).resolves.toBeUndefined();
    });
  });
});
