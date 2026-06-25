import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateAdminFinancialAidManagementDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsOptional()
  @IsString()
  amount?: string;
}
