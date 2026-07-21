// backend/src/modules/orders/dto/create-order-notification.dto.ts
import { IsNumber, IsString, IsOptional, Min } from 'class-validator';

export class CreateOrderNotificationDto {
  @IsString()
  orderNumber: string;

  @IsNumber()
  @Min(0)
  total: number;

  @IsString()
  @IsOptional()
  status?: string;
}
