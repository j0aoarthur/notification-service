import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import * as amqp from 'amqplib';
import { appConfig } from '../config/app.config';

/**
 * Serviço responsável por garantir a topologia do RabbitMQ no momento do bootstrap.
 *
 * Como o NestJS Microservices não cria automaticamente a infraestrutura completa
 * (DLQ, Retry com TTL, e roteamento entre eles), este serviço usa a biblioteca
 * amqplib nativa para assertar as filas antes de começarmos a consumir mensagens.
 *
 * Topologia:
 * 1. notifications_queue: DLX -> notifications_retry_queue
 * 2. notifications_retry_queue: TTL -> DLX -> notifications_queue
 * 3. notifications_dead_queue: Fila final para mensagens com falha permanente
 */
@Injectable()
export class RabbitmqSetupService implements OnApplicationBootstrap {
  private readonly logger = new Logger(RabbitmqSetupService.name);

  constructor(
    @Inject(appConfig.KEY)
    private readonly config: ConfigType<typeof appConfig>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    this.logger.log('Asserting RabbitMQ topology (Queues, TTL, DLX)...');

    try {
      const connection = await amqp.connect(this.config.rabbitmq.uri);
      const channel = await connection.createChannel();

      const { queue, retryQueue, deadQueue, retryTtlMs } = this.config.rabbitmq;

      // 1. Fila Principal
      // Mensagens rejeitadas (nack requeue:false) vêm para a retryQueue
      await channel.assertQueue(queue, {
        durable: true,
        arguments: {
          'x-dead-letter-exchange': '',
          'x-dead-letter-routing-key': retryQueue,
        },
      });

      // 2. Fila de Retry (Espera)
      // Não deve ter consumidores. Quando o TTL expirar, a mensagem
      // é enviada de volta para a fila principal.
      await channel.assertQueue(retryQueue, {
        durable: true,
        arguments: {
          'x-dead-letter-exchange': '',
          'x-dead-letter-routing-key': queue,
          'x-message-ttl': retryTtlMs,
        },
      });

      // 3. Fila Dead Letter (DLQ)
      // Mensagens que excedem o maxRetries são publicadas aqui manualmente pelo Controller.
      await channel.assertQueue(deadQueue, {
        durable: true,
      });

      await channel.close();
      await connection.close();
      this.logger.log('RabbitMQ topology asserted successfully.');
    } catch (error) {
      this.logger.error(
        `Failed to assert RabbitMQ topology: ${(error as Error).message}`,
      );
    }
  }
}
