import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InstagramPost } from './instagram-post.entity';
import { InstagramService } from './instagram.service';

@Module({
  imports: [TypeOrmModule.forFeature([InstagramPost])],
  providers: [InstagramService],
  exports: [InstagramService],
})
export class InstagramModule {}
