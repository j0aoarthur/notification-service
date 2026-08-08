import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SendNotificationDTO } from './send-notification.dto';
import { NotificationChannel } from '../../domain/entities/notification-payload.entity';

const basePayload = {
  recipient: 'usuario@example.com',
  templateId: 'welcome-email',
  channel: NotificationChannel.EMAIL,
  variables: { firstName: 'João' },
};

describe('SendNotificationDTO', () => {
  it('é válido quando senderId está ausente', async () => {
    const dto = plainToInstance(SendNotificationDTO, { ...basePayload });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('é inválido quando senderId contém letra maiúscula', async () => {
    const dto = plainToInstance(SendNotificationDTO, {
      ...basePayload,
      senderId: 'Suporte',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'senderId')).toBe(true);
  });

  it('é inválido quando senderId contém espaço', async () => {
    const dto = plainToInstance(SendNotificationDTO, {
      ...basePayload,
      senderId: 'time suporte',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'senderId')).toBe(true);
  });

  it('é inválido quando senderId contém underscore', async () => {
    const dto = plainToInstance(SendNotificationDTO, {
      ...basePayload,
      senderId: 'time_suporte',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'senderId')).toBe(true);
  });

  it("é válido quando senderId é 'avisos-2'", async () => {
    const dto = plainToInstance(SendNotificationDTO, {
      ...basePayload,
      senderId: 'avisos-2',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});
