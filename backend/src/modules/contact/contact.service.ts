import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContactSubmission, ContactStatus } from './contact-submission.entity';

@Injectable()
export class ContactService {
  constructor(
    @InjectRepository(ContactSubmission)
    private readonly contactRepository: Repository<ContactSubmission>,
  ) {}

  async create(data: Partial<ContactSubmission>): Promise<ContactSubmission> {
    const submission = this.contactRepository.create(data);
    return this.contactRepository.save(submission);
  }

  async findAll(restaurantId: string): Promise<ContactSubmission[]> {
    return this.contactRepository.find({ where: { restaurantId }, order: { createdAt: 'DESC' } });
  }

  async findOne(id: string, restaurantId: string): Promise<ContactSubmission> {
    const item = await this.contactRepository.findOne({ where: { id, restaurantId } });
    if (!item) throw new NotFoundException('Contact submission not found');
    return item;
  }

  async updateStatus(id: string, restaurantId: string, status: ContactStatus): Promise<ContactSubmission> {
    const item = await this.findOne(id, restaurantId);
    item.status = status;
    return this.contactRepository.save(item);
  }
}
