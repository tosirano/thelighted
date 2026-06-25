import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateAdminFinancialAidManagementDto } from './dto/create-admin-financial-aid-management.dto';
import { UpdateAdminFinancialAidManagementDto } from './dto/update-admin-financial-aid-management.dto';

@Injectable()
export class AdminFinancialAidManagementService {
  private readonly items: Array<{ id: string } & CreateAdminFinancialAidManagementDto> = [];

  findAll() {
    return this.items;
  }

  findOne(id: string) {
    const item = this.items.find((entry) => entry.id === id);
    if (!item) {
      throw new NotFoundException('AdminFinancialAidManagement item not found');
    }
    return item;
  }

  create(payload: CreateAdminFinancialAidManagementDto) {
    const created = { id: crypto.randomUUID(), ...payload };
    this.items.push(created);
    return created;
  }

  update(id: string, payload: UpdateAdminFinancialAidManagementDto) {
    const item = this.findOne(id);
    Object.assign(item, payload);
    return item;
  }

  remove(id: string) {
    const index = this.items.findIndex((entry) => entry.id === id);
    if (index === -1) {
      throw new NotFoundException('AdminFinancialAidManagement item not found');
    }
    this.items.splice(index, 1);
    return { id, deleted: true };
  }
}
