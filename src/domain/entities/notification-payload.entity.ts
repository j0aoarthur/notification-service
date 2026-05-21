/**
 * Canal de entrega suportado pelo serviço de notificações.
 * Referência: specs/001-eda-notification-service/data-model.md § NotificationChannel
 */
export enum NotificationChannel {
  EMAIL = 'EMAIL',
  SMS = 'SMS',
}

/**
 * Entidade que representa o contrato de dados genérico recebido via RabbitMQ.
 * É completamente agnóstica ao domínio — não contém referências a entidades
 * de negócio como "usuário", "pedido" ou "turno".
 *
 * Referência: specs/001-eda-notification-service/data-model.md § NotificationPayload
 * Contrato: specs/001-eda-notification-service/contracts/notification.contract.md
 */
export class NotificationPayload {
  /** Endereço de e-mail ou número de telefone do destinatário */
  readonly recipient: string;

  /** Identificador do template Handlebars a ser compilado (ex.: 'welcome-email') */
  readonly templateId: string;

  /** Canal de entrega alvo */
  readonly channel: NotificationChannel;

  /** Dados dinâmicos que serão interpolados no template */
  readonly variables: Record<string, unknown>;

  constructor(
    recipient: string,
    templateId: string,
    channel: NotificationChannel,
    variables: Record<string, unknown>,
  ) {
    this.recipient = recipient;
    this.templateId = templateId;
    this.channel = channel;
    this.variables = variables;
  }
}
