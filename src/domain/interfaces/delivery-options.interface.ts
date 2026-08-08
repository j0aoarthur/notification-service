import { EmailSender } from '../value-objects/email-sender.value-object';

/**
 * Opções adicionais, específicas do canal, para a entrega de uma mensagem.
 * Hoje carrega apenas a identidade de remetente resolvida (relevante para
 * EMAIL); outros canais podem ignorá-la.
 */
export interface DeliveryOptions {
  sender?: EmailSender;
}
