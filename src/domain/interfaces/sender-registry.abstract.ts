import { EmailSender } from '../value-objects/email-sender.value-object';

/**
 * Contrato abstrato para o registry de identidades de remetente.
 * Permite que a implementação concreta (arquivo JSON versionado no repo)
 * seja substituída sem afetar nenhuma lógica de negócio.
 *
 * Implementação concreta: src/infrastructure/senders/file-sender-registry.service.ts
 *
 * Referência: specs/001-eda-notification-service/data-model.md § SenderRegistry
 */
export abstract class SenderRegistry {
  /**
   * Resolve um `senderId` opcional para uma identidade de remetente válida.
   *
   * @param senderId - Identificador curto da identidade (ex.: 'suporte').
   *                    Ausente ⇒ resolve para o remetente padrão do serviço.
   * @returns EmailSender correspondente
   * @throws {UnknownSenderException} Se `senderId` não existir no registry
   */
  abstract resolve(senderId?: string): EmailSender;
}
