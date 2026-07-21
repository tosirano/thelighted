import {
  Controller,
  Get,
  Put,
  Param,
  Body,
  Query,
  Request,
  Post,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { CreateUserDto } from './create-user.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminRole } from '../auth/admin-user.entity';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post('users')
  @Roles(AdminRole.SUPER_ADMIN)
  async createUser(@Body() data: CreateUserDto, @Request() req) {
    const restaurantId = req.user.restaurantId;
    return await this.adminService.createUser(
      data,
      restaurantId,
      req.user.role,
    );
  }

  @Get('dashboard')
  async getDashboard(@Request() req) {
    const restaurantId = req.user.restaurantId;
    return await this.adminService.getDashboardStats(restaurantId);
  }

  @Get('audit-logs')
  @Roles(AdminRole.ADMIN, AdminRole.SUPER_ADMIN)
  async getAuditLogs(@Query('limit') limit?: string, @Request() req?) {
    const limitNum = limit ? parseInt(limit, 10) : 50;
    const restaurantId = req.user.restaurantId;
    return await this.adminService.getAuditLogs(restaurantId, limitNum);
  }

  @Get('users')
  async getAllAdmins(@Request() req) {
    const restaurantId = req.user.restaurantId;
    return await this.adminService.getAllAdmins(restaurantId);
  }

  @Put('users/:id/status')
  @Roles(AdminRole.SUPER_ADMIN)
  async toggleAdminStatus(
    @Param('id') id: string,
    @Body('isActive') isActive: boolean,
    @Request() req,
  ) {
    const restaurantId = req.user.restaurantId;
    return await this.adminService.toggleAdminStatus(
      id,
      restaurantId,
      isActive,
      req.user.id,
      req.user.role,
    );
  }

  @Put('users/:id/role')
  @Roles(AdminRole.SUPER_ADMIN)
  async updateAdminRole(
    @Param('id') id: string,
    @Body('role') role: string,
    @Request() req,
  ) {
    const restaurantId = req.user.restaurantId;
    return await this.adminService.updateAdminRole(
      id,
      restaurantId,
      role,
      req.user.id,
      req.user.role,
    );
  }
}
