import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { appConfig } from './infrastructure/config/app.config';
import { RabbitmqModule } from './infrastructure/messaging/rabbitmq.module';
import { NotificationController } from './presentation/controllers/notification.controller';
import { ProcessNotificationUseCase } from './application/use-cases/process-notification.use-case';
import { TEMPLATE_ENGINE } from './domain/interfaces/template-engine.interface';
import { HandlebarsTemplateEngine } from './infrastructure/template-engine/handlebars-template-engine.service';
import { DeliveryProviderRegistry } from './application/services/delivery-provider-registry.service';
import { DELIVERY_PROVIDERS } from './domain/interfaces/delivery-provider.interface';
import { NodemailerEmailProvider } from './infrastructure/providers/email/nodemailer-email.provider';
import { LogSmsProvider } from './infrastructure/providers/sms/log-sms.provider';

/**
 * Módulo raiz da aplicação.
 *
 * Importações previstas nas próximas fases:
 *   - Phase 4 (US2): HandlebarsTemplateEngine provider (token: TEMPLATE_ENGINE)
 *   - Phase 5 (US3): NodemailerEmailProvider, LogSmsProvider, DeliveryProviderRegistry (token: DELIVERY_PROVIDERS)
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
      provide: TEMPLATE_ENGINE,
      useClass: HandlebarsTemplateEngine,
    },
    NodemailerEmailProvider,
    LogSmsProvider,
    {
      provide: DELIVERY_PROVIDERS,
      useFactory: (emailProvider: NodemailerEmailProvider, smsProvider: LogSmsProvider) => {
        return [emailProvider, smsProvider];
      },
      inject: [NodemailerEmailProvider, LogSmsProvider],
    },
    DeliveryProviderRegistry,
  ],
})
export class AppModule {}
