import { Module, ClassProvider } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { appConfig } from './infrastructure/config/app.config';
import { RabbitmqModule } from './infrastructure/messaging/rabbitmq.module';
import { NotificationController } from './presentation/controllers/notification.controller';
import { ProcessNotificationUseCase } from './application/use-cases/process-notification.use-case';
import { TemplateEngine } from './domain/interfaces/template-engine';
import { HandlebarsTemplateEngine } from './infrastructure/template-engine/handlebars-template-engine.service';
import { DeliveryProviderRegistry } from './application/services/delivery-provider-registry.service';
import { DeliveryProvider } from './domain/interfaces/delivery-provider';
import { NodemailerEmailProvider } from './infrastructure/providers/email/nodemailer-email.provider';
import { LogSmsProvider } from './infrastructure/providers/sms/log-sms.provider';

/**
 * Módulo raiz da aplicação.
 *
 * Importações previstas nas próximas fases:
 *   - Phase 4 (US2): HandlebarsTemplateEngine provider
 *   - Phase 5 (US3): NodemailerEmailProvider, LogSmsProvider, DeliveryProviderRegistry
 *
 * Referência: specs/001-eda-notification-service/plan.md
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
    }),
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
