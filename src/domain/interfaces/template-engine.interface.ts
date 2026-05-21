import { NotificationChannel } from '../entities/notification-payload.entity';
import { CompiledMessage } from '../value-objects/compiled-message.value-object';

/**
 * Contrato abstrato para o motor de compilação de templates.
 * Permite que a implementação concreta (Handlebars) seja substituída
 * sem afetar nenhuma lógica de negócio.
 *
 * Implementação concreta: src/infrastructure/template-engine/handlebars-template-engine.service.ts
 *
 * Referência: specs/001-eda-notification-service/data-model.md § TemplateEngine
 */
export interface TemplateEngine {
  /**
   * Carrega o template identificado por `templateId` do filesystem,
   * interpola as `variables` e retorna um `CompiledMessage` pronto para entrega.
   *
   * @param templateId - Identificador do template (ex.: 'welcome-email')
   * @param channel - Canal de entrega (determina o diretório do template)
   * @param variables - Dados dinâmicos para interpolação no template
   * @returns CompiledMessage com subject e body compilados
   * @throws {TemplateNotFoundException} Se o arquivo .hbs não for encontrado
   */
  compile(
    templateId: string,
    channel: NotificationChannel,
    variables: Record<string, unknown>,
    recipient: string,
  ): Promise<CompiledMessage>;
}

/** Token de injeção de dependência para o TemplateEngine */
export const TEMPLATE_ENGINE = 'TEMPLATE_ENGINE';
