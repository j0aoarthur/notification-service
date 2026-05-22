import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { appConfig } from './infrastructure/config/app.config';
import { RabbitmqModule } from './infrastructure/messaging/rabbitmq.module';
import { NotificationController } from './presentation/controllers/notification.controller';
import { ProcessNotificationUseCase } from './application/use-cases/process-notification.use-case';
import { TemplateEngine } from './domain/interfaces/template-engine.abstract';
import { HandlebarsTemplateEngine } from './infrastructure/template-engine/handlebars-template-engine.service';
import { DeliveryProviderRegistry } from './application/services/delivery-provider-registry.service';
import { NodemailerEmailProvider } from './infrastructure/providers/email/nodemailer-email.provider';
import { LogSmsProvider } from './infrastructure/providers/sms/log-sms.provider';
import { MetricsModule } from './infrastructure/metrics/metrics.module';

/**
 * Módulo raiz da aplicação.
 *
 * FR-005, SC-004: O sistema suporta provedores de entrega plugáveis.
 * O `DeliveryProviderRegistry` é construído via factory, recebendo explicitamente
 * todos os providers concretos e os agrupando em array — padrão seguro no NestJS
 * para class tokens (multi:true não é confiável com abstract class como token).
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
    
    // Providers concretos registrados individualmente
    NodemailerEmailProvider,
    LogSmsProvider,
    {
      provide: DeliveryProviderRegistry,
      useFactory: (
        email: NodemailerEmailProvider,
        sms: LogSmsProvider,
      ) => new DeliveryProviderRegistry([email, sms]),
      inject: [NodemailerEmailProvider, LogSmsProvider],
    },
  ],
})
export class AppModule {}
