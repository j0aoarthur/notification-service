import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { Resend } from 'resend';
import { appConfig } from '../../config/app.config';
import { DeliveryProvider } from '../../../domain/interfaces/delivery-provider.abstract';
import { DeliveryOptions } from '../../../domain/interfaces/delivery-options.interface';
import { NotificationChannel } from '../../../domain/entities/notification-payload.entity';
import { CompiledMessage } from '../../../domain/value-objects/compiled-message.value-object';
import { EmailSender } from '../../../domain/value-objects/email-sender.value-object';

/**
 * Provedor de entrega de e-mails usando o SDK oficial do Resend.
 *
 * ATENÇÃO: `resend.emails.send()` NÃO lança exceção em caso de falha da API —
 * ela retorna `{ data: null, error: {...} }`. É obrigatório checar `error`
 * explicitamente e convertê-lo em `throw`, senão uma falha de envio vira
 * sucesso silencioso (ack indevido na fila).
 *
 * Referência: specs/001-eda-notification-service/spec.md § User Story 3
 */
@Injectable()
export class ResendEmailProvider implements DeliveryProvider {
  private readonly logger = new Logger(ResendEmailProvider.name);
  readonly channel = NotificationChannel.EMAIL;
  private readonly client: Resend;

  constructor(
    @Inject(appConfig.KEY)
    private readonly config: ConfigType<typeof appConfig>,
  ) {
    this.client = new Resend(this.config.resend.apiKey);
  }

  /**
   * Envia o e-mail via API do Resend.
   * Em caso de falha (retornada pela API ou de rede/timeout do SDK), lança
   * um Error e o caso de uso propaga a falha (retry via nack continua igual
   * ao comportamento padrão de qualquer outro provider).
   *
   * FR-007: Logar apenas que a tentativa ocorreu, SEM detalhes de PII.
   */
  async send(
    message: CompiledMessage,
    options?: DeliveryOptions,
  ): Promise<void> {
    const sender =
      options?.sender ??
      new EmailSender(
        this.config.email.defaultFrom,
        this.config.email.defaultFromName,
      );

    try {
      const { error } = await this.client.emails.send({
        from: sender.toRfc5322(),
        to: message.recipient,
        subject: message.subject ?? 'Sem Assunto',
        html: message.body,
      });

      if (error) {
        this.logger.error(`Falha no provedor Resend. Erro: ${error.message}`);
        throw new Error(`Falha no provedor Resend: ${error.message}`);
      }
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.startsWith('Falha no provedor Resend:')
      ) {
        throw error;
      }

      this.logger.error(
        `Falha no provedor Resend. Erro: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  /**
   * Verifica se a API key do Resend está operacional, listando domínios
   * (chamada leve, sem cruzar com o registry de remetentes).
   */
  async isHealthy(): Promise<boolean> {
    try {
      const { error } = await this.client.domains.list();
      if (error) {
        this.logger.warn(`Verificação Resend falhou: ${error.message}`);
        return false;
      }
      return true;
    } catch (error) {
      this.logger.warn(
        `Verificação Resend falhou: ${(error as Error).message}`,
      );
      return false;
    }
  }
}
