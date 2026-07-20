// backend/src/modules/orders/orders.gateway.ts
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

interface OrderSocketUser {
  sub: string;
  username: string;
  role: string;
  restaurantId: string;
}

export interface NewOrderEvent {
  orderId: string;
  orderNumber: string;
  status: string;
  total: number;
  createdAt: string;
}

export interface OrderStatusChangedEvent {
  orderId: string;
  orderNumber: string;
  status: string;
  updatedAt: string;
}

function restaurantRoom(restaurantId: string): string {
  return `restaurant:${restaurantId}`;
}

// Namespaced so future gateways (e.g. table/reservation updates) don't share
// this connection's auth handshake or event names.
@WebSocketGateway({
  namespace: '/orders',
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
})
export class OrdersGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(OrdersGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  // Guards decorate message handlers, not the initial handshake, so the JWT
  // is verified here and the socket is dropped immediately if it's missing
  // or invalid — matching the HTTP JwtAuthGuard's behavior for this domain.
  handleConnection(client: Socket): void {
    const token = client.handshake.auth?.token as string | undefined;

    if (!token) {
      this.rejectConnection(client, 'Missing authentication token');
      return;
    }

    try {
      const payload = this.jwtService.verify<OrderSocketUser>(token, {
        secret: this.configService.get('JWT_SECRET') || 'your-secret-key',
      });

      if (!payload.restaurantId) {
        this.rejectConnection(client, 'Token missing restaurant scope');
        return;
      }

      client.data.user = payload;
      void client.join(restaurantRoom(payload.restaurantId));
      this.logger.log(
        `Client ${client.id} connected (restaurant ${payload.restaurantId})`,
      );
    } catch {
      this.rejectConnection(client, 'Invalid or expired token');
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Client ${client.id} disconnected`);
  }

  private rejectConnection(client: Socket, reason: string): void {
    client.emit('connection:error', { message: reason });
    client.disconnect(true);
  }

  emitNewOrder(restaurantId: string, event: NewOrderEvent): void {
    this.server.to(restaurantRoom(restaurantId)).emit('order:new', event);
  }

  emitOrderStatusChanged(
    restaurantId: string,
    event: OrderStatusChangedEvent,
  ): void {
    this.server
      .to(restaurantRoom(restaurantId))
      .emit('order:status_changed', event);
  }
}
