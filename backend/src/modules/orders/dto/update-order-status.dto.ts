// backend/src/modules/orders/dto/update-order-status.dto.ts
import { IsOptional, IsString } from 'class-validator';

export class UpdateOrderStatusDto {
  @IsString()
  status: string;

  @IsString()
  @IsOptional()
  orderNumber?: string;
}
