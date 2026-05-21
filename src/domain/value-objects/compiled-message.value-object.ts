import { NotificationChannel } from '../entities/notification-payload.entity';

/**
 * Value Object que representa a notificação totalmente compilada e pronta para entrega.
 * É produzido pelo TemplateEngine e consumido pelo DeliveryProvider.
 *
 * ATENÇÃO: O campo `body` contém o conteúdo compilado da mensagem e NUNCA deve
 * ser incluído em logs (FR-007: mascaramento total de PII).
 *
 * Referência: specs/001-eda-notification-service/data-model.md § CompiledMessage
 */
export class CompiledMessage {
  /** Destinatário final da entrega (e-mail ou número de telefone) */
  readonly recipient: string;

  /** Canal de entrega alvo */
  readonly channel: NotificationChannel;

  /**
   * Assunto compilado (populado para EMAIL; null para SMS).
   * NUNCA deve ser registrado em logs.
   */
  readonly subject: string | null;

  /**
   * Corpo da mensagem totalmente compilado e legível por humanos.
   * NUNCA deve ser registrado em logs.
   */
  readonly body: string;

  constructor(
    recipient: string,
    channel: NotificationChannel,
    subject: string | null,
    body: string,
  ) {
    this.recipient = recipient;
    this.channel = channel;
    this.subject = subject;
    this.body = body;
  }
}
