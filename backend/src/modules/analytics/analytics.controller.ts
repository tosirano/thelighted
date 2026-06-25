import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { TrackEventDto } from './analytics.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Post('track')
  async trackEvent(@Body() dto: TrackEventDto) {
    return this.analyticsService.trackEvent(dto);
  }

  @Post('summary')
  @UseGuards(JwtAuthGuard)
  async getSummary(@Request() req) {
    return this.analyticsService.getSummary(req.user.restaurantId);
  }
}
