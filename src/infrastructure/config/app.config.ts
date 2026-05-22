import { registerAs } from '@nestjs/config';
import { from } from 'rxjs';

/**
 * Schema de configuração da aplicação.
 * Todas as variáveis de ambiente são lidas aqui e validadas em tempo de inicialização.
 */
export const appConfig = registerAs('app', () => ({
  rabbitmq: {
    uri: process.env['RABBITMQ_URI'] ?? 'amqp://guest:guest@localhost:5672',
    queue: process.env['RABBITMQ_QUEUE'] ?? 'notifications_queue',
    retryQueue:
      process.env['RABBITMQ_RETRY_QUEUE'] ?? 'notifications_retry_queue',
    deadQueue:
      process.env['RABBITMQ_DEAD_QUEUE'] ?? 'notifications_dead_queue',
    retryTtlMs: parseInt(
      process.env['RABBITMQ_RETRY_TTL_MS'] ?? '30000',
      10,
    ),
    maxRetries: parseInt(process.env['RABBITMQ_MAX_RETRIES'] ?? '5', 10),
  },
  smtp: {
    host: process.env['SMTP_HOST'] ?? 'localhost',
    port: parseInt(process.env['SMTP_PORT'] ?? '1025', 10),
    user: process.env['SMTP_USER'] ?? '',
    pass: process.env['SMTP_PASS'] ?? '',
    from: process.env['SMTP_FROM'] ?? 'noreply@notification-service.local',
    fromName: process.env['SMTP_FROM_NAME'] ?? 'notification-service.local',
  },
}));

export type AppConfig = ReturnType<typeof appConfig>;
