// backend/src/modules/orders/orders.controller.ts
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateOrderNotificationDto } from './dto/create-order-notification.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrdersGateway } from './orders.gateway';

// There is no persisted Orders domain yet — these endpoints are the
// integration point real order creation/status-update flows will call into
// once that domain lands. For now they broadcast directly over the
// OrdersGateway so the real-time notification path can be built and tested
// end-to-end ahead of it.
@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly ordersGateway: OrdersGateway) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Request() req, @Body() dto: CreateOrderNotificationDto) {
    const order = {
      orderId: uuid(),
      orderNumber: dto.orderNumber,
      status: dto.status ?? 'pending',
      total: dto.total,
      createdAt: new Date().toISOString(),
    };

    this.ordersGateway.emitNewOrder(req.user.restaurantId, order);

    return order;
  }

  @Patch(':orderId/status')
  @HttpCode(HttpStatus.OK)
  updateStatus(
    @Request() req,
    @Param('orderId') orderId: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    const event = {
      orderId,
      orderNumber: dto.orderNumber ?? orderId,
      status: dto.status,
      updatedAt: new Date().toISOString(),
    };

    this.ordersGateway.emitOrderStatusChanged(req.user.restaurantId, event);

    return event;
  }
}
