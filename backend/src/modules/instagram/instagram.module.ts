import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Otp } from './otp.entity';
import { OtpsService } from './otps.service';

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([Otp])],
  providers: [OtpsService],
  exports: [OtpsService],
})
export class OtpsModule {}
