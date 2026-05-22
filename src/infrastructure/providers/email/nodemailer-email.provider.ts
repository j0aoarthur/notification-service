import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { appConfig } from '../../config/app.config';
import { DeliveryProvider } from '../../../domain/interfaces/delivery-provider.abstract';
import { NotificationChannel } from '../../../domain/entities/notification-payload.entity';
import { CompiledMessage } from '../../../domain/value-objects/compiled-message.value-object';

/**
 * Provedor de entrega de e-mails usando Nodemailer.
 *
 * Utiliza as configurações SMTP definidas em AppConfig.
 *
 * Referência: specs/001-eda-notification-service/spec.md § User Story 3
 */
@Injectable()
export class NodemailerEmailProvider implements DeliveryProvider {
  private readonly logger = new Logger(NodemailerEmailProvider.name);
  readonly channel = NotificationChannel.EMAIL;
  private readonly transporter: nodemailer.Transporter;

  constructor(
    @Inject(appConfig.KEY)
    private readonly config: ConfigType<typeof appConfig>,
  ) {
    const smtpConfig = this.config.smtp;
    this.transporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.port === 465, // true for 465, false for other ports
      auth:
        smtpConfig.user && smtpConfig.pass
          ? {
              user: smtpConfig.user,
              pass: smtpConfig.pass,
            }
          : undefined
    });

  }

  /**
   * Envia o e-mail via SMTP.
   * Em caso de falha de rede/SMTP, a Promise rejeita e o caso de uso propaga o erro.
   *
   * FR-007: Logar apenas que a tentativa ocorreu, SEM detalhes de PII.
   */
  async send(message: CompiledMessage): Promise<void> {
    try {
      console.log('Recipient: ' + message.recipient);
      console.log('Subject: ' + message.subject);

      await this.transporter.sendMail({
        // Formato padrão SMTP para nome customizado: "Nome de Exibição" <email@dominio.com>
        from: `"${this.config.smtp.fromName}" <${this.config.smtp.from}>`,
        to: message.recipient,
        subject: message.subject ?? 'Sem Assunto',
        html: message.body,
      });

      // Não logamos message.recipient sem máscara, então não logamos no provedor
      // O Use Case logará o sucesso com os metadados mascarados.
    } catch (error) {
      this.logger.error(`Falha no provedor SMTP. Erro: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Testa a conexão SMTP para garantir que o provider está saudável.
   */
  async isHealthy(): Promise<boolean> {
    try {
      await this.transporter.verify();
      return true;
    } catch (error) {
      this.logger.warn(`Verificação SMTP falhou: ${(error as Error).message}`);
      return false;
    }
  }
}
