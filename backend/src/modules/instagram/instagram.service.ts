import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InstagramPost } from './instagram-post.entity';

@Injectable()
export class InstagramService {
  constructor(
    @InjectRepository(InstagramPost)
    private readonly instagramPostRepository: Repository<InstagramPost>,
  ) {}

  async findAll(restaurantId: string): Promise<InstagramPost[]> {
    return this.instagramPostRepository.find({
      where: { restaurantId, isVisible: true },
      order: { displayOrder: 'ASC', createdAt: 'DESC' },
    });
  }

  async create(data: Partial<InstagramPost>): Promise<InstagramPost> {
    const post = this.instagramPostRepository.create(data);
    return this.instagramPostRepository.save(post);
  }

  async remove(id: string, restaurantId: string): Promise<void> {
    const post = await this.instagramPostRepository.findOne({ where: { id, restaurantId } });
    if (!post) throw new NotFoundException('Instagram post not found');
    await this.instagramPostRepository.remove(post);
  }
}
