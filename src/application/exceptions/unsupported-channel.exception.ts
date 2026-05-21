import { NotificationChannel } from '../../domain/entities/notification-payload.entity';

/**
 * Lançada quando o DeliveryProviderRegistry não encontra nenhum provider
 * registrado para o canal especificado no payload.
 * O NotificationController captura esta exceção e executa nack com requeue: false.
 *
 * Referência: specs/001-eda-notification-service/research.md § Provider Dispatch
 */
export class UnsupportedChannelException extends Error {
  readonly channel: string;
  readonly supportedChannels: NotificationChannel[];

  constructor(channel: string, supportedChannels: NotificationChannel[]) {
    super(
      `Canal não suportado: '${channel}'. ` +
        `Canais disponíveis: ${supportedChannels.join(', ')}.`,
    );
    this.name = 'UnsupportedChannelException';
    this.channel = channel;
    this.supportedChannels = supportedChannels;

    // Necessário para instanceof funcionar corretamente com classes que estendem Error no TypeScript
    Object.setPrototypeOf(this, UnsupportedChannelException.prototype);
  }
}
