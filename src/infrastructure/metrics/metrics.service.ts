import { Injectable } from '@nestjs/common';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter } from 'prom-client';

@Injectable()
export class MetricsService {
  constructor(
    @InjectMetric('notification_success_total') private readonly successCounter: Counter<string>,
    @InjectMetric('notification_failure_total') private readonly failureCounter: Counter<string>,
    @InjectMetric('notification_retry_total') private readonly retryCounter: Counter<string>,
  ) {}

  recordSuccess(channel: string, templateId: string): void {
    this.successCounter.labels(channel, templateId).inc();
  }

  recordFailure(channel: string, templateId: string): void {
    this.failureCounter.labels(channel, templateId).inc();
  }

  recordRetry(channel: string, templateId: string): void {
    this.retryCounter.labels(channel, templateId).inc();
  }
}
