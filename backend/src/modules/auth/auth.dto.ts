// backend/src/modules/auth/auth.dto.ts
import {
  IsString,
  IsEmail,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class LoginDto {
  @IsString()
  @Transform(({ value }) => value?.trim())
  username: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;
}

export class RegisterAdminDto {
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message: 'Username can only contain letters, numbers, hyphens, and underscores',
  })
  @Transform(({ value }) => value?.trim())
  username: string;

  @IsEmail()
  @Transform(({ value }) => value?.trim().toLowerCase())
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;

  @IsString()
  @MinLength(3)
  @MaxLength(255)
  @Transform(({ value }) => value?.trim())
  restaurantName: string;

  @IsString()
  @MinLength(10)
  @MaxLength(20)
  @Matches(/^[0-9+\-() ]+$/, {
    message: 'Phone number can only contain digits, +, -, (, ) and spaces',
  })
  restaurantPhone: string;

  @IsEmail()
  @Transform(({ value }) => value?.trim().toLowerCase())
  restaurantEmail: string;
}

export class ChangePasswordDto {
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  currentPassword: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword: string;
}
