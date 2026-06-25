import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { EventType } from './analytics-event.entity';

export class TrackEventDto {
  @IsEnum(EventType)
  eventType: EventType;

  @IsUUID()
  restaurantId: string;

  @IsOptional()
  @IsUUID()
  itemId?: string;

  @IsOptional()
  @IsString()
  page?: string;

  @IsOptional()
  metadata?: Record<string, any>;
}
