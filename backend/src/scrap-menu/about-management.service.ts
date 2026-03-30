import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateAboutManagementDto } from './dto/create-about-management.dto';
import { UpdateAboutManagementDto } from './dto/update-about-management.dto';

@Injectable()
export class AboutManagementService {
  private readonly items: Array<{ id: string } & CreateAboutManagementDto> = [];

  findAll() {
    return this.items;
  }

  findOne(id: string) {
    const item = this.items.find((entry) => entry.id === id);
    if (!item) {
      throw new NotFoundException('AboutManagement item not found');
    }
    return item;
  }

  create(payload: CreateAboutManagementDto) {
    const created = { id: crypto.randomUUID(), ...payload };
    this.items.push(created);
    return created;
  }

  update(id: string, payload: UpdateAboutManagementDto) {
    const item = this.findOne(id);
    Object.assign(item, payload);
    return item;
  }

  remove(id: string) {
    const index = this.items.findIndex((entry) => entry.id === id);
    if (index === -1) {
      throw new NotFoundException('AboutManagement item not found');
    }
    this.items.splice(index, 1);
    return { id, deleted: true };
  }
}
