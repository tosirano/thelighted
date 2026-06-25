import { PartialType } from '@nestjs/mapped-types';
import { CreateAdminFinancialAidManagementDto } from './create-admin-financial-aid-management.dto';

export class UpdateAdminFinancialAidManagementDto extends PartialType(CreateAdminFinancialAidManagementDto) {}
