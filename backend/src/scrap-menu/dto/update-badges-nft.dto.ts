import { PartialType } from '@nestjs/mapped-types';
import { CreateBadgesNftDto } from './create-badges-nft.dto';

export class UpdateBadgesNftDto extends PartialType(CreateBadgesNftDto) {}
