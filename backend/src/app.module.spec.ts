import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppModule throttler configuration', () => {
  let module: TestingModule;

  beforeAll(async () => {
    process.env.THROTTLE_TTL = '60';
    process.env.THROTTLE_LIMIT = '100';

    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        ThrottlerModule.forRootAsync({
          imports: [ConfigModule],
          inject: [ConfigService],
          useFactory: (configService: ConfigService) => ({
            throttlers: [
              {
                ttl: (configService.get('THROTTLE_TTL') || 60) * 1000,
                limit: configService.get('THROTTLE_LIMIT') || 100,
              },
            ],
          }),
        }),
      ],
      controllers: [AppController],
      providers: [AppService],
    }).compile();
  });

  afterAll(() => {
    delete process.env.THROTTLE_TTL;
    delete process.env.THROTTLE_LIMIT;
  });

  it('should have AppController defined', () => {
    const controller = module.get(AppController);
    expect(controller).toBeDefined();
  });

  it('should read THROTTLE_TTL from env', () => {
    const configService = module.get(ConfigService);
    const ttl = configService.get('THROTTLE_TTL');
    expect(ttl).toBe('60');
  });

  it('should read THROTTLE_LIMIT from env', () => {
    const configService = module.get(ConfigService);
    const limit = configService.get('THROTTLE_LIMIT');
    expect(limit).toBe('100');
  });

  it('should have ThrottlerModule configured', () => {
    const throttlerModule = module.get(ThrottlerModule);
    expect(throttlerModule).toBeDefined();
  });
});
