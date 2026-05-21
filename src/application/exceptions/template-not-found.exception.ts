import { NotificationChannel } from '../../domain/entities/notification-payload.entity';

/**
 * Lançada quando o arquivo .hbs de um template não é encontrado no filesystem.
 * O NotificationController captura esta exceção e executa nack com requeue: false.
 *
 * Referência: specs/001-eda-notification-service/research.md § Template Resolution
 */
export class TemplateNotFoundException extends Error {
  readonly templateId: string;
  readonly channel: NotificationChannel;

  constructor(templateId: string, channel: NotificationChannel) {
    super(
      `Template não encontrado: '${templateId}' para o canal '${channel}'. ` +
        `Verifique se o arquivo src/infrastructure/templates/${channel.toLowerCase()}/${templateId}.hbs existe.`,
    );
    this.name = 'TemplateNotFoundException';
    this.templateId = templateId;
    this.channel = channel;

    // Necessário para instanceof funcionar corretamente com classes que estendem Error no TypeScript
    Object.setPrototypeOf(this, TemplateNotFoundException.prototype);
  }
}
