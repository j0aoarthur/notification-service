import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import type { ConfigType } from '@nestjs/config';
import { appConfig } from './infrastructure/config/app.config';
import { RabbitmqModule } from './infrastructure/messaging/rabbitmq.module';
import { NotificationController } from './presentation/controllers/notification.controller';
import { ProcessNotificationUseCase } from './application/use-cases/process-notification.use-case';
import { TemplateEngine } from './domain/interfaces/template-engine.abstract';
import { HandlebarsTemplateEngine } from './infrastructure/template-engine/handlebars-template-engine.service';
import { SenderRegistry } from './domain/interfaces/sender-registry.abstract';
import { FileSenderRegistry } from './infrastructure/senders/file-sender-registry.service';
import { DeliveryProviderRegistry } from './application/services/delivery-provider-registry.service';
import { DeliveryProvider } from './domain/interfaces/delivery-provider.abstract';
import { NodemailerEmailProvider } from './infrastructure/providers/email/nodemailer-email.provider';
import { ResendEmailProvider } from './infrastructure/providers/email/resend-email.provider';
import { LogSmsProvider } from './infrastructure/providers/sms/log-sms.provider';
import { MetricsModule } from './infrastructure/metrics/metrics.module';

/** Token de injeção para o provedor de entrega de e-mail selecionado em runtime. */
const EMAIL_DELIVERY_PROVIDER = Symbol('EMAIL_DELIVERY_PROVIDER');

/**
 * Módulo raiz da aplicação.
 *
 * FR-005, SC-004: O sistema suporta provedores de entrega plugáveis.
 * O `DeliveryProviderRegistry` é construído via factory, recebendo explicitamente
 * todos os providers concretos e os agrupando em array — padrão seguro no NestJS
 * para class tokens (multi:true não é confiável com abstract class como token).
 *
 * O provedor de e-mail concreto (SMTP via Nodemailer ou Resend) é selecionado
 * condicionalmente por `config.email.provider`, via uma factory que instancia
 * apenas o provider escolhido — evita, por exemplo, o NodemailerEmailProvider
 * tentar abrir uma conexão SMTP quando o Resend é quem está ativo.
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
      provide: SenderRegistry,
      useClass: FileSenderRegistry,
    },

    // Providers concretos registrados individualmente
    LogSmsProvider,
    {
      provide: EMAIL_DELIVERY_PROVIDER,
      useFactory: (config: ConfigType<typeof appConfig>) => {
        if (config.email.provider === 'resend') {
          if (!config.resend.apiKey) {
            throw new Error(
              'EMAIL_PROVIDER=resend exige RESEND_API_KEY definido.',
            );
          }
          return new ResendEmailProvider(config);
        }
        return new NodemailerEmailProvider(config);
      },
      inject: [appConfig.KEY],
    },
    {
      provide: DeliveryProviderRegistry,
      useFactory: (email: DeliveryProvider, sms: LogSmsProvider) =>
        new DeliveryProviderRegistry([email, sms]),
      inject: [EMAIL_DELIVERY_PROVIDER, LogSmsProvider],
    },
  ],
})
export class AppModule {}
