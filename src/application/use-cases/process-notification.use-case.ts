import { Inject, Injectable, Logger } from '@nestjs/common';
import { SendNotificationDTO } from '../dtos/send-notification.dto';
import { TemplateEngine } from '../../domain/interfaces/template-engine';
import { DeliveryProviderRegistry } from '../services/delivery-provider-registry.service';

/**
 * Caso de Uso: Processar Notificação.
 *
 * Este é o orquestrador central do fluxo de notificação. Recebe o DTO validado
 * do controller e coordena as operações de domínio:
 *   1. Compilar o template via TemplateEngine (US2 — Phase 4)
 *   2. Rotear a mensagem compilada ao DeliveryProvider correto (US3 — Phase 5)
 *   3. Tratar falhas de provider para ativação do mecanismo de retry via DLX (US4 — Phase 6)
 *
 * STATUS ATUAL: Stub para validação do fluxo end-to-end da US1.
 * A lógica de template engine e de provider dispatch será adicionada nas fases 4 e 5.
 *
 * Referência: specs/001-eda-notification-service/spec.md § User Story 1
 * Referência: specs/001-eda-notification-service/plan.md § Phase 3
 */
@Injectable()
export class ProcessNotificationUseCase {
  private readonly logger = new Logger(ProcessNotificationUseCase.name);

  constructor(
    private readonly templateEngine: TemplateEngine,
    private readonly registry: DeliveryProviderRegistry,
  ) {}

  /**
   * Executa o pipeline completo de processamento de notificação.
   *
   * @param dto - Payload validado e transformado pelo `NotificationController`.
   *              ATENÇÃO: `dto.variables` contém PII — NUNCA logar este campo.
   * @throws {TemplateNotFoundException} Quando o template não existe no filesystem (US2).
   * @throws {UnsupportedChannelException} Quando não há provider para o channel (US3).
   * @throws {Error} Quando o provider externo falha durante a entrega (US4).
   */
  async execute(dto: SendNotificationDTO): Promise<void> {
    // [US1] Apenas registra os metadados do payload.
    // NÃO loga dto.variables (PII — FR-007).
    this.logger.log(
      `Executando ProcessNotificationUseCase | templateId: ${dto.templateId} | channel: ${dto.channel}`,
    );

    // [US2 - Phase 4]: Compilação do template
    const compiledMessage = await this.templateEngine.compile(
      dto.templateId,
      dto.channel,
      dto.variables,
      dto.recipient,
    );

    this.logger.log(
      `Template compilado com sucesso | templateId: ${dto.templateId} | channel: ${dto.channel}`,
    );

    // [US3 - Phase 5]: Despachar a mensagem
    const provider = this.registry.resolve(dto.channel);
    await provider.send(compiledMessage);

    this.logger.log(
      `Mensagem entregue com sucesso via provider | channel: ${dto.channel}`,
    );
  }
}
