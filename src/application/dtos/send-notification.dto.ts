import {
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsString,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { NotificationChannel } from '../../domain/entities/notification-payload.entity';

/**
 * DTO de validação do contrato universal de notificação.
 * Mapeamento 1:1 com o JSON Schema em:
 *   specs/001-eda-notification-service/contracts/notification.contract.md
 *
 * Aplicado pelo ValidationPipe do NestJS no NotificationController
 * antes que qualquer lógica de negócio seja invocada.
 *
 * Referência: specs/001-eda-notification-service/data-model.md § NotificationPayload Validation Rules
 */
export class SendNotificationDTO {
  /**
   * Endereço de e-mail ou número de telefone do destinatário.
   * PII — NUNCA deve ser registrado em logs sem mascaramento.
   */
  @IsString()
  @IsNotEmpty({ message: 'O destinatário não pode estar vazio.' })
  recipient!: string;

  /**
   * Identificador do template Handlebars.
   * Deve conter apenas letras, números e hífens (ex.: 'welcome-email').
   */
  @IsString()
  @IsNotEmpty({ message: 'O identificador do template não pode estar vazio.' })
  @Matches(/^[a-z0-9-]+$/, {
    message:
      'O templateId deve conter apenas letras minúsculas, números e hífens.',
  })
  templateId!: string;

  /**
   * Canal de entrega alvo.
   * Deve ser um dos valores suportados pelo enum NotificationChannel.
   */
  @IsEnum(NotificationChannel, {
    message: `O canal deve ser um dos seguintes valores: ${Object.values(NotificationChannel).join(', ')}.`,
  })
  channel!: NotificationChannel;

  /**
   * Dados dinâmicos para interpolação no template.
   * PII — NUNCA deve ser registrado em logs.
   */
  @IsObject({ message: 'As variáveis devem ser um objeto.' })
  @Type(() => Object)
  variables!: Record<string, unknown>;
}
