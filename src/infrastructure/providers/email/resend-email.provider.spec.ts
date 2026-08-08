import type { ConfigType } from '@nestjs/config';
import { appConfig } from '../../config/app.config';
import { ResendEmailProvider } from './resend-email.provider';
import { CompiledMessage } from '../../../domain/value-objects/compiled-message.value-object';
import { EmailSender } from '../../../domain/value-objects/email-sender.value-object';
import { NotificationChannel } from '../../../domain/entities/notification-payload.entity';

const mockSend = jest.fn();
const mockDomainsList = jest.fn();

jest.mock('resend', () => {
  return {
    Resend: jest.fn().mockImplementation(() => ({
      emails: { send: mockSend },
      domains: { list: mockDomainsList },
    })),
  };
});

describe('ResendEmailProvider', () => {
  const config = {
    email: {
      defaultFrom: 'noreply@notification-service.local',
      defaultFromName: 'notification-service.local',
      sendersFile: '',
      provider: 'resend',
    },
    resend: {
      apiKey: 'test-api-key',
    },
  } as unknown as ConfigType<typeof appConfig>;

  const RECIPIENT_PII = 'sensitive-recipient@example.com';
  const SUBJECT_PII = 'Assunto sigiloso do teste';
  const BODY_PII = '<p>Corpo confidencial do teste</p>';

  let provider: ResendEmailProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    provider = new ResendEmailProvider(config);
  });

  describe('send', () => {
    it('envia com sucesso usando o sender explícito das options', async () => {
      mockSend.mockResolvedValue({ data: { id: 'email_123' }, error: null });

      const sender = new EmailSender(
        'suporte@empresa.com',
        'Equipe de Suporte',
      );
      const message = new CompiledMessage(
        RECIPIENT_PII,
        NotificationChannel.EMAIL,
        SUBJECT_PII,
        BODY_PII,
      );

      await provider.send(message, { sender });

      expect(mockSend).toHaveBeenCalledWith({
        from: sender.toRfc5322(),
        to: RECIPIENT_PII,
        subject: SUBJECT_PII,
        html: BODY_PII,
      });
    });

    it('usa o fallback de config.email.defaultFrom/defaultFromName quando options.sender está ausente', async () => {
      mockSend.mockResolvedValue({ data: { id: 'email_456' }, error: null });

      const message = new CompiledMessage(
        RECIPIENT_PII,
        NotificationChannel.EMAIL,
        SUBJECT_PII,
        BODY_PII,
      );

      await provider.send(message);

      const expectedFrom = new EmailSender(
        config.email.defaultFrom,
        config.email.defaultFromName,
      ).toRfc5322();

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({ from: expectedFrom }),
      );
    });

    it('lança erro quando o SDK retorna { data: null, error }', async () => {
      mockSend.mockResolvedValue({
        data: null,
        error: {
          message: 'Domain not verified',
          statusCode: 403,
          name: 'validation_error',
        },
      });

      const message = new CompiledMessage(
        RECIPIENT_PII,
        NotificationChannel.EMAIL,
        SUBJECT_PII,
        BODY_PII,
      );

      await expect(provider.send(message)).rejects.toThrow();
    });

    it('propaga falha de rede/timeout do SDK', async () => {
      mockSend.mockRejectedValue(new Error('ECONNRESET'));

      const message = new CompiledMessage(
        RECIPIENT_PII,
        NotificationChannel.EMAIL,
        SUBJECT_PII,
        BODY_PII,
      );

      await expect(provider.send(message)).rejects.toThrow('ECONNRESET');
    });

    it('nunca loga recipient, subject ou body (PII) em caso de sucesso ou falha', async () => {
      const logSpy = jest.spyOn(
        (
          provider as unknown as {
            logger: { log: (...args: unknown[]) => void };
          }
        ).logger,
        'log',
      );
      const errorSpy = jest.spyOn(
        (
          provider as unknown as {
            logger: { error: (...args: unknown[]) => void };
          }
        ).logger,
        'error',
      );

      const message = new CompiledMessage(
        RECIPIENT_PII,
        NotificationChannel.EMAIL,
        SUBJECT_PII,
        BODY_PII,
      );

      mockSend.mockResolvedValue({ data: { id: 'email_ok' }, error: null });
      await provider.send(message);

      mockSend.mockResolvedValue({
        data: null,
        error: {
          message: 'boom',
          statusCode: 500,
          name: 'internal_server_error',
        },
      });
      await expect(provider.send(message)).rejects.toThrow();

      const allLoggedArgs = [
        ...logSpy.mock.calls,
        ...errorSpy.mock.calls,
      ].flat();

      for (const arg of allLoggedArgs) {
        expect(String(arg)).not.toContain(RECIPIENT_PII);
        expect(String(arg)).not.toContain(SUBJECT_PII);
        expect(String(arg)).not.toContain(BODY_PII);
      }
    });
  });

  describe('isHealthy', () => {
    it('retorna true quando domains.list não retorna erro', async () => {
      mockDomainsList.mockResolvedValue({ data: { data: [] }, error: null });

      await expect(provider.isHealthy()).resolves.toBe(true);
    });

    it('retorna false quando domains.list retorna erro', async () => {
      mockDomainsList.mockResolvedValue({
        data: null,
        error: {
          message: 'invalid api key',
          statusCode: 401,
          name: 'invalid_api_key',
        },
      });

      await expect(provider.isHealthy()).resolves.toBe(false);
    });

    it('retorna false em caso de exceção de rede', async () => {
      mockDomainsList.mockRejectedValue(new Error('network down'));

      await expect(provider.isHealthy()).resolves.toBe(false);
    });
  });
});
