import type { ConfigType } from '@nestjs/config';
import { appConfig } from '../../config/app.config';
import { NodemailerEmailProvider } from './nodemailer-email.provider';
import { CompiledMessage } from '../../../domain/value-objects/compiled-message.value-object';
import { EmailSender } from '../../../domain/value-objects/email-sender.value-object';
import { NotificationChannel } from '../../../domain/entities/notification-payload.entity';
import * as nodemailer from 'nodemailer';

jest.mock('nodemailer');

describe('NodemailerEmailProvider', () => {
  const config = {
    smtp: {
      host: 'localhost',
      port: 1025,
      user: '',
      pass: '',
    },
    email: {
      defaultFrom: 'noreply@notification-service.local',
      defaultFromName: 'Notification Service',
      sendersFile: '',
      provider: 'smtp',
    },
  } as unknown as ConfigType<typeof appConfig>;

  let mockSendMail: jest.Mock;
  let mockVerify: jest.Mock;
  let provider: NodemailerEmailProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSendMail = jest.fn().mockResolvedValue({ messageId: 'msg-123' });
    mockVerify = jest.fn().mockResolvedValue(true);

    (nodemailer.createTransport as jest.Mock).mockReturnValue({
      sendMail: mockSendMail,
      verify: mockVerify,
    });

    provider = new NodemailerEmailProvider(config);
  });

  describe('send', () => {
    it('envia e-mail com remetente customizado e payload compilado', async () => {
      const sender = new EmailSender('custom-sender@example.com', 'Custom Sender');
      const message = new CompiledMessage(
        'destinatario@example.com',
        NotificationChannel.EMAIL,
        'Assunto de Teste',
        '<h1>Conteúdo do E-mail</h1>',
      );

      await provider.send(message, { sender });

      expect(mockSendMail).toHaveBeenCalledWith({
        from: '"Custom Sender" <custom-sender@example.com>',
        to: 'destinatario@example.com',
        subject: 'Assunto de Teste',
        html: '<h1>Conteúdo do E-mail</h1>',
      });
    });

    it('usa remetente padrão quando options.sender não é fornecido', async () => {
      const message = new CompiledMessage(
        'destinatario@example.com',
        NotificationChannel.EMAIL,
        'Assunto Teste',
        '<p>Corpo</p>',
      );

      await provider.send(message);

      expect(mockSendMail).toHaveBeenCalledWith({
        from: '"Notification Service" <noreply@notification-service.local>',
        to: 'destinatario@example.com',
        subject: 'Assunto Teste',
        html: '<p>Corpo</p>',
      });
    });

    it('propaga erro quando o transporte SMTP falha', async () => {
      mockSendMail.mockRejectedValue(new Error('SMTP Connection refused'));

      const message = new CompiledMessage(
        'destinatario@example.com',
        NotificationChannel.EMAIL,
        'Assunto',
        '<p>Corpo</p>',
      );

      await expect(provider.send(message)).rejects.toThrow(
        'SMTP Connection refused',
      );
    });
  });

  describe('isHealthy', () => {
    it('retorna true quando verify tem sucesso', async () => {
      mockVerify.mockResolvedValue(true);
      await expect(provider.isHealthy()).resolves.toBe(true);
    });

    it('retorna false quando verify rejeita', async () => {
      mockVerify.mockRejectedValue(new Error('Connection timeout'));
      await expect(provider.isHealthy()).resolves.toBe(false);
    });
  });
});
