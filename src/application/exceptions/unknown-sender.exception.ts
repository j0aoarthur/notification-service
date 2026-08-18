/**
 * Lançada quando o SenderRegistry não encontra nenhuma identidade de
 * remetente registrada para o `senderId` especificado no payload.
 * O NotificationController captura esta exceção e executa nack com requeue: false.
 *
 * Referência: specs/001-eda-notification-service/research.md § Sender Identity Resolution
 */
export class UnknownSenderException extends Error {
  readonly senderId: string;

  constructor(senderId: string) {
    super(
      `Identidade de remetente desconhecida: '${senderId}'. ` +
        `Verifique se o senderId está registrado em src/infrastructure/config/senders.json.`,
    );
    this.name = 'UnknownSenderException';
    this.senderId = senderId;

    // Necessário para instanceof funcionar corretamente com classes que estendem Error no TypeScript
    Object.setPrototypeOf(this, UnknownSenderException.prototype);
  }
}
