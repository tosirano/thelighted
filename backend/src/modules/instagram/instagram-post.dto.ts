import { IsBoolean, IsDateString, IsNotEmpty, IsNumber, IsOptional, IsString, IsUrl } from 'class-validator';

export class CreateInstagramPostDto {
  @IsUrl()
  imageUrl: string;

  @IsString()
  @IsNotEmpty()
  caption: string;

  @IsUrl()
  permalink: string;

  @IsDateString()
  timestamp: string;

  @IsOptional()
  @IsBoolean()
  isVisible?: boolean;

  @IsOptional()
  @IsNumber()
  displayOrder?: number;

  @IsString()
  @IsNotEmpty()
  restaurantId: string;
}
