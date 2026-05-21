import { Module } from '@nestjs/common';
import { PrometheusModule, makeCounterProvider } from '@willsoto/nestjs-prometheus';
import { MetricsService } from './metrics.service';

const metricProviders = [
  makeCounterProvider({
    name: 'notification_success_total',
    help: 'Total number of successfully processed notifications',
    labelNames: ['channel', 'templateId'],
  }),
  makeCounterProvider({
    name: 'notification_failure_total',
    help: 'Total number of permanently failed notifications',
    labelNames: ['channel', 'templateId'],
  }),
  makeCounterProvider({
    name: 'notification_retry_total',
    help: 'Total number of retried notifications',
    labelNames: ['channel', 'templateId'],
  }),
];

@Module({
  imports: [PrometheusModule.register()],
  providers: [...metricProviders, MetricsService],
  exports: [MetricsService],
})
export class MetricsModule {}
