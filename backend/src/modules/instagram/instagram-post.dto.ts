import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class LinkBankAccountDto {
  @ApiProperty({ example: 'Example Bank' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  bankName: string;

  @ApiProperty({ example: 'Jane Doe' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  accountHolderName: string;

  @ApiProperty({ example: '0123456789' })
  @IsString()
  @Matches(/^\d{8,17}$/)
  accountNumber: string;

  @ApiProperty({ example: '110000000' })
  @IsString()
  @MinLength(6)
  @MaxLength(32)
  routingNumber: string;
}
