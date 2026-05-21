import { Controller, Logger, UsePipes, ValidationPipe } from '@nestjs/common';
import {
  Ctx,
  EventPattern,
  Payload,
  RmqContext,
} from '@nestjs/microservices';
import { Channel, Message } from 'amqplib';
import { SendNotificationDTO } from '../../application/dtos/send-notification.dto';
import { ProcessNotificationUseCase } from '../../application/use-cases/process-notification.use-case';
import { MetricsService } from '../../infrastructure/metrics/metrics.service';
import { Inject } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { appConfig } from '../../infrastructure/config/app.config';

/**
 * Controller de apresentação responsável por consumir mensagens da fila principal.
 *
 * Responsabilidades:
 *   1. Receber a mensagem bruta do RabbitMQ e transformá-la em `SendNotificationDTO`.
 *   2. Confirmar (`ack`) a mensagem ao processar com sucesso.
 *   3. Rejeitar (`nack` com requeue: false) em casos de falha de validação ou erro de negócio,
 *      delegando ao mecanismo de DLX do broker o tratamento de retentativas.
 *
 * REGRA DE SEGURANÇA (FR-007):
 *   - NUNCA incluir `variables`, `body` compilado ou `recipient` não-mascarado em logs.
 *   - Logar APENAS: templateId, channel, e recipient mascarado.
 *
 * Referência: specs/001-eda-notification-service/spec.md § User Story 1
 */
@Controller()
export class NotificationController {
  private readonly logger = new Logger(NotificationController.name);

  constructor(
    private readonly processNotificationUseCase: ProcessNotificationUseCase,
    private readonly metricsService: MetricsService,
    @Inject(appConfig.KEY)
    private readonly config: ConfigType<typeof appConfig>,
  ) {}

  /**
   * Handler principal do microserviço.
   * Escuta o padrão de evento correspondente à fila principal de notificações.
   *
   * O `@UsePipes(ValidationPipe)` aqui é declarado explicitamente para garantir
   * que o payload bruto AMQP é transformado e validado contra `SendNotificationDTO`
   * antes que qualquer lógica de negócio seja executada.
   */
  @EventPattern('notifications_queue')
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: false,
    }),
  )
  async handleNotification(
    @Payload() dto: SendNotificationDTO,
    @Ctx() context: RmqContext,
  ): Promise<void> {
    const channel = context.getChannelRef() as Channel;
    const originalMessage = context.getMessage() as Message;

    const maskedRecipient = this.maskRecipient(dto.recipient);

    const headers = originalMessage.properties.headers || {};
    const xDeath = headers['x-death'];
    let currentRetryCount = 0;

    if (Array.isArray(xDeath)) {
      const deathInfo = xDeath.find(
        (x: any) => x.queue === this.config.rabbitmq.queue,
      );
      if (deathInfo) {
        currentRetryCount = deathInfo.count;
      }
    }

    if (currentRetryCount >= this.config.rabbitmq.maxRetries) {
      this.logger.error(
        `Limite de retentativas excedido (${currentRetryCount}/${this.config.rabbitmq.maxRetries}). Roteando para DLQ | templateId: ${dto.templateId} | channel: ${dto.channel} | recipient: ${maskedRecipient}`,
      );
      this.metricsService.recordFailure(dto.channel, dto.templateId);
      channel.sendToQueue(this.config.rabbitmq.deadQueue, originalMessage.content, {
        headers: originalMessage.properties.headers,
      });
      channel.ack(originalMessage);
      return;
    }

    this.logger.log(
      `Payload recebido (tentativa ${currentRetryCount + 1}) | templateId: ${dto.templateId} | channel: ${dto.channel} | recipient: ${maskedRecipient}`,
    );

    try {
      await this.processNotificationUseCase.execute(dto);
      channel.ack(originalMessage);
      this.metricsService.recordSuccess(dto.channel, dto.templateId);
      this.logger.log(
        `Notificação processada com sucesso | templateId: ${dto.templateId} | channel: ${dto.channel}`,
      );
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Erro desconhecido';

      this.logger.error(
        `Falha ao processar notificação | templateId: ${dto.templateId} | channel: ${dto.channel} | recipient: ${maskedRecipient} | erro: ${errorMessage}`,
      );
      this.metricsService.recordRetry(dto.channel, dto.templateId);

      // nack com requeue: false → o broker encaminha para a notifications_retry_queue via DLX
      channel.nack(originalMessage, false, false);
    }
  }

  /**
   * Mascara o recipient para que nenhum PII apareça nos logs (FR-007).
   *
   * Estratégia:
   *   - E-mail: exibe somente o domínio  (ex.: ***@empresa.com)
   *   - Telefone ou outros: exibe somente os últimos 4 caracteres (ex.: ***9876)
   */
  private maskRecipient(recipient: string): string {
    if (recipient.includes('@')) {
      const [, domain] = recipient.split('@');
      return `***@${domain}`;
    }

    const visibleChars = 4;
    if (recipient.length <= visibleChars) {
      return '***';
    }

    return `***${recipient.slice(-visibleChars)}`;
  }
}
