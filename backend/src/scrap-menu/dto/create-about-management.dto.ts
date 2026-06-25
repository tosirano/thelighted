import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateAboutManagementDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  content: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;
}
