import { Injectable, Logger } from '@nestjs/common';
import { DeliveryProvider } from '../../../domain/interfaces/delivery-provider';
import { NotificationChannel } from '../../../domain/entities/notification-payload.entity';
import { CompiledMessage } from '../../../domain/value-objects/compiled-message.value-object';

/**
 * Provedor de entrega de SMS simulado (Stub para v1).
 *
 * Registra a tentativa de envio apenas em log, respeitando as regras
 * de mascaramento de PII (FR-007).
 *
 * Referência: specs/001-eda-notification-service/spec.md § User Story 3
 */
@Injectable()
export class LogSmsProvider implements DeliveryProvider {
  private readonly logger = new Logger(LogSmsProvider.name);
  readonly channel = NotificationChannel.SMS;

  async send(message: CompiledMessage): Promise<void> {
    const maskedRecipient = this.maskRecipient(message.recipient);

    // NUNCA logar message.body
    this.logger.log(
      `[SIMULAÇÃO SMS] Enviando SMS para: ${maskedRecipient}`,
    );

    // Simula um tempo de latência de rede
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  async isHealthy(): Promise<boolean> {
    // Provedor de log sempre está saudável
    return true;
  }

  /**
   * Mascara o telefone mantendo apenas os 4 últimos dígitos (FR-007).
   */
  private maskRecipient(recipient: string): string {
    const visibleChars = 4;
    if (recipient.length <= visibleChars) {
      return '***';
    }

    return `***${recipient.slice(-visibleChars)}`;
  }
}
