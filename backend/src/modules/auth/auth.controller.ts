import {
  Controller,
  Post,
  Get,
  Body,
  Request,
  HttpCode,
  HttpStatus,
  Patch,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto, RegisterAdminDto, ChangePasswordDto } from './auth.dto';
import { UpdateRegisterAdminDto } from './update-auth.dto';
import { Public } from '../../common/decorators/public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto) {
    return await this.authService.login(loginDto);
  }

  @Post('register')
  @Public()
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() registerAdminDto: RegisterAdminDto) {
    return await this.authService.register(registerAdminDto);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @Request() req,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    const restaurantId = req.user.restaurantId;
    return await this.authService.changePassword(
      req.user.id,
      changePasswordDto,
      restaurantId,
    );
  }

  @Get('me')
  async getProfile(@Request() req) {
    return req.user;
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout() {
    return { message: 'Logged out successfully' };
  }

  @Patch('profile')
  async updateUser(@Request() req, @Body() data: UpdateRegisterAdminDto) {
    const restaurantId = req.user.restaurantId;
    return await this.authService.updateUserProfile(
      req.user.id,
      data,
      restaurantId,
    );
  }
}
