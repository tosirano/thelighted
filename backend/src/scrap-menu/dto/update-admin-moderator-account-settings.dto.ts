import { PartialType } from '@nestjs/mapped-types';
import { CreateAdminModeratorAccountSettingsDto } from './create-admin-moderator-account-settings.dto';

export class UpdateAdminModeratorAccountSettingsDto extends PartialType(CreateAdminModeratorAccountSettingsDto) {}
