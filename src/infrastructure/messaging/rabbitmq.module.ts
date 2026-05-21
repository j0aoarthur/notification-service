import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { RabbitmqSetupService } from './rabbitmq-setup.service';

/**
 * Token de injeção para o cliente RabbitMQ (usado para publicar mensagens, se necessário).
 * O consumer é configurado diretamente no main.ts via RmqTransport.
 */
export const RABBITMQ_CLIENT = 'RABBITMQ_CLIENT';

/**
 * Módulo de infraestrutura responsável pela configuração do RabbitMQ.
 *
 * Topologia de filas declarada:
 *   - notifications_queue      : Fila principal. Declara x-dead-letter-exchange para retry.
 *   - notifications_retry_queue: Fila de retentativa com TTL. Ao expirar, a mensagem
 *                                retorna para a fila principal.
 *   - notifications_dead_queue : Dead Letter Queue (DLQ). Recebe mensagens que excederam
 *                                o número máximo de tentativas.
 *
 * NOTA: A declaração das filas com x-dead-letter-exchange deve ser feita via
 * assertQueue no consumidor (NotificationController) ou via RabbitMQ Management UI /
 * definição no docker-compose. As opções abaixo configuram o transporte de conexão.
 *
 * Referência: specs/001-eda-notification-service/research.md § Retry Strategy
 */
@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: RABBITMQ_CLIENT,
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => {
          const uri =
            configService.get<string>('app.rabbitmq.uri') ??
            'amqp://guest:guest@localhost:5672';
          const queue =
            configService.get<string>('app.rabbitmq.queue') ??
            'notifications_queue';
          const retryQueue =
            configService.get<string>('app.rabbitmq.retryQueue') ??
            'notifications_retry_queue';
          return {
            transport: Transport.RMQ,
            options: {
              urls: [uri],
              queue,
              queueOptions: {
                durable: true,
                arguments: {
                  'x-dead-letter-exchange': '',
                  'x-dead-letter-routing-key': retryQueue,
                },
              },
              noAck: false,
            },
          };
        },
      },
    ]),
  ],
  providers: [RabbitmqSetupService],
  exports: [ClientsModule],
})
export class RabbitmqModule {}
