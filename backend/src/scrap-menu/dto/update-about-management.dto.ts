import { PartialType } from '@nestjs/mapped-types';
import { CreateAboutManagementDto } from './create-about-management.dto';

export class UpdateAboutManagementDto extends PartialType(CreateAboutManagementDto) {}
