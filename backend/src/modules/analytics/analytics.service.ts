import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AnalyticsEvent } from './analytics-event.entity';
import { TrackEventDto } from './analytics.dto';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(AnalyticsEvent)
    private readonly analyticsEventRepository: Repository<AnalyticsEvent>,
  ) {}

  async trackEvent(dto: TrackEventDto): Promise<AnalyticsEvent> {
    const event = this.analyticsEventRepository.create(dto);
    return this.analyticsEventRepository.save(event);
  }

  async getSummary(restaurantId: string) {
    const total = await this.analyticsEventRepository.count({
      where: { restaurantId },
    });
    return { restaurantId, total };
  }
}
