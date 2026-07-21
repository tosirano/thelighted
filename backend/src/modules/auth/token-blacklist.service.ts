import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class TokenBlacklistService implements OnModuleDestroy {
  private client: RedisClientType;
  private isConnected = false;

  constructor() {
    this.client = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
    });
    this.client.on('error', () => {});
    this.client.connect().then(() => {
      this.isConnected = true;
    }).catch(() => {});
  }

  async onModuleDestroy() {
    if (this.isConnected) {
      await this.client.disconnect();
    }
  }

  async blacklistToken(jti: string, ttlSeconds: number): Promise<void> {
    if (!this.isConnected) return;
    try {
      await this.client.setEx(`bl:${jti}`, ttlSeconds, '1');
    } catch {}
  }

  async isBlacklisted(jti: string): Promise<boolean> {
    if (!this.isConnected) return false;
    try {
      const result = await this.client.get(`bl:${jti}`);
      return result === '1';
    } catch {
      return false;
    }
  }

  async blacklistRefreshToken(jti: string, ttlSeconds: number): Promise<void> {
    if (!this.isConnected) return;
    try {
      await this.client.setEx(`rt:${jti}`, ttlSeconds, '1');
    } catch {}
  }

  async isRefreshTokenValid(jti: string): Promise<boolean> {
    if (!this.isConnected) return true;
    try {
      const result = await this.client.get(`rt:${jti}`);
      return result === '1';
    } catch {
      return true;
    }
  }

  async revokeRefreshToken(jti: string): Promise<void> {
    if (!this.isConnected) return;
    try {
      await this.client.del(`rt:${jti}`);
    } catch {}
  }
}
