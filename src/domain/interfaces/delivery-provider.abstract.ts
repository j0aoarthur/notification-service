import { NotificationChannel } from '../entities/notification-payload.entity';
import { CompiledMessage } from '../value-objects/compiled-message.value-object';

/**
 * Contrato abstrato que todo adaptador de entrega deve implementar.
 * Permite que novos canais de entrega sejam adicionados sem modificar
 * nenhuma lógica existente (Open/Closed Principle — SC-004).
 *
 * Implementações concretas residem na camada de infraestrutura:
 *   src/infrastructure/providers/
 *
 * Referência: specs/001-eda-notification-service/data-model.md § DeliveryProvider
 */
export abstract class DeliveryProvider {
  /** Canal de entrega que este provider implementa */
  abstract readonly channel: NotificationChannel;

  /**
   * Envia a mensagem compilada ao destinatário final via o canal correspondente.
   * ATENÇÃO: O conteúdo de `message` contém PII e NUNCA deve ser registrado em logs.
   *
   * @throws {Error} Se a entrega falhar (o mecanismo de retry via DLX tratará a falha)
   */
  abstract send(message: CompiledMessage): Promise<void>;

  /**
   * Verifica se o provider está operacional.
   * Usado durante a inicialização do serviço para diagnóstico.
   */
  abstract isHealthy?(): Promise<boolean>;
}
