// backend/src/modules/orders/orders.module.ts
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OrdersController } from './orders.controller';
import { OrdersGateway } from './orders.gateway';

@Module({
  imports: [AuthModule],
  controllers: [OrdersController],
  providers: [OrdersGateway],
  exports: [OrdersGateway],
})
export class OrdersModule {}
