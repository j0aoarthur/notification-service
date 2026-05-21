import { Module, ClassProvider } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { appConfig } from './infrastructure/config/app.config';
import { RabbitmqModule } from './infrastructure/messaging/rabbitmq.module';
import { NotificationController } from './presentation/controllers/notification.controller';
import { ProcessNotificationUseCase } from './application/use-cases/process-notification.use-case';
import { TemplateEngine } from './domain/interfaces/template-engine.abstract';
import { HandlebarsTemplateEngine } from './infrastructure/template-engine/handlebars-template-engine.service';
import { DeliveryProviderRegistry } from './application/services/delivery-provider-registry.service';
import { DeliveryProvider } from './domain/interfaces/delivery-provider.abstract';
import { NodemailerEmailProvider } from './infrastructure/providers/email/nodemailer-email.provider';
import { LogSmsProvider } from './infrastructure/providers/sms/log-sms.provider';
import { MetricsModule } from './infrastructure/metrics/metrics.module';

/**
 * Módulo raiz da aplicação.
 *
 * FR-005, SC-004: O sistema suporta provedores de entrega plugáveis.
 * O `DeliveryProviderRegistry` recebe uma coleção de provedores (graças ao `multi: true`)
 * e roteia a notificação para o provedor apropriado em runtime, sem alterar a regra de negócio.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
    }),
    MetricsModule,
    RabbitmqModule,
  ],
  controllers: [NotificationController],
  providers: [
    ProcessNotificationUseCase,
    {
      provide: TemplateEngine,
      useClass: HandlebarsTemplateEngine,
    },
    {
      provide: DeliveryProvider,
      useClass: NodemailerEmailProvider,
      multi: true,
    } as ClassProvider,
    {
      provide: DeliveryProvider,
      useClass: LogSmsProvider,
      multi: true,
    } as ClassProvider,
    DeliveryProviderRegistry,
  ],
})
export class AppModule {}
