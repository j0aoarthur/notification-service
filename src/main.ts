import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

/**
 * Inicializa o serviço de notificações como um microserviço NestJS
 * conectado ao RabbitMQ via protocolo AMQP.
 *
 * Configurações importantes:
 *   - noAck: false  → Confirmação manual de mensagens (necessário para retry via DLX)
 *   - durable: true → A fila sobrevive a reinicializações do broker
 *   - ValidationPipe → Transforma e valida payloads antes de chegarem ao handler
 *
 * Referência: specs/001-eda-notification-service/research.md § Retry Strategy
 */
async function bootstrap(): Promise<void> {
  const rabbitmqUri =
    process.env['RABBITMQ_URI'] ?? 'amqp://guest:guest@localhost:5672';
  const queueName =
    process.env['RABBITMQ_QUEUE'] ?? 'notifications_queue';
  const retryQueueName =
    process.env['RABBITMQ_RETRY_QUEUE'] ?? 'notifications_retry_queue';

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.RMQ,
      options: {
        urls: [rabbitmqUri],
        queue: queueName,
        queueOptions: {
          durable: true,
          arguments: {
            // Mensagens com nack(requeue: false) são encaminhadas para a fila de retry
            'x-dead-letter-exchange': '',
            'x-dead-letter-routing-key': retryQueueName,
          },
        },
        noAck: false,
      },
    },
  );

  // Aplica validação global — transforma payloads brutos em DTOs tipados
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: false,
    }),
  );

  await app.listen();
  console.log('Serviço de notificações iniciado e aguardando mensagens.');
}

void bootstrap();
