import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateBadgesNftDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;
}
