import { Test, TestingModule } from '@nestjs/testing';
import { ProcessNotificationUseCase } from './process-notification.use-case';
import { TemplateEngine } from '../../domain/interfaces/template-engine.abstract';
import { SenderRegistry } from '../../domain/interfaces/sender-registry.abstract';
import { DeliveryProviderRegistry } from '../services/delivery-provider-registry.service';
import { DeliveryProvider } from '../../domain/interfaces/delivery-provider.abstract';
import { NotificationChannel } from '../../domain/entities/notification-payload.entity';
import { CompiledMessage } from '../../domain/value-objects/compiled-message.value-object';
import { EmailSender } from '../../domain/value-objects/email-sender.value-object';
import { SendNotificationDTO } from '../dtos/send-notification.dto';

describe('ProcessNotificationUseCase', () => {
  let useCase: ProcessNotificationUseCase;
  let mockTemplateEngine: jest.Mocked<TemplateEngine>;
  let mockSenderRegistry: jest.Mocked<SenderRegistry>;
  let mockEmailProvider: jest.Mocked<DeliveryProvider>;
  let mockSmsProvider: jest.Mocked<DeliveryProvider>;

  beforeEach(async () => {
    mockTemplateEngine = {
      compile: jest.fn().mockImplementation(
        async (
          templateId: string,
          channel: NotificationChannel,
          _variables: Record<string, unknown>,
          recipient: string,
        ) =>
          new CompiledMessage(
            recipient,
            channel,
            channel === NotificationChannel.EMAIL ? 'Assunto Teste' : null,
            '<p>Corpo Compilado</p>',
          ),
      ),
    } as unknown as jest.Mocked<TemplateEngine>;

    mockSenderRegistry = {
      resolve: jest.fn().mockImplementation((senderId?: string) => {
        if (senderId) {
          return new EmailSender('custom@example.com', 'Custom Sender');
        }
        return new EmailSender('default@example.com', 'Default Sender');
      }),
    } as unknown as jest.Mocked<SenderRegistry>;

    mockEmailProvider = {
      channel: NotificationChannel.EMAIL,
      send: jest.fn().mockResolvedValue(undefined),
      isHealthy: jest.fn().mockResolvedValue(true),
    };

    mockSmsProvider = {
      channel: NotificationChannel.SMS,
      send: jest.fn().mockResolvedValue(undefined),
      isHealthy: jest.fn().mockResolvedValue(true),
    };

    const providerRegistry = new DeliveryProviderRegistry([
      mockEmailProvider,
      mockSmsProvider,
    ]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProcessNotificationUseCase,
        {
          provide: TemplateEngine,
          useValue: mockTemplateEngine,
        },
        {
          provide: SenderRegistry,
          useValue: mockSenderRegistry,
        },
        {
          provide: DeliveryProviderRegistry,
          useValue: providerRegistry,
        },
      ],
    }).compile();

    useCase = module.get<ProcessNotificationUseCase>(
      ProcessNotificationUseCase,
    );
  });

  it('deve compilar template de e-mail e enviar com remetente customizado quando senderId é informado', async () => {
    const dto: SendNotificationDTO = {
      recipient: 'destinatario@example.com',
      templateId: 'template-email-teste',
      channel: NotificationChannel.EMAIL,
      senderId: 'remetente-personalizado',
      variables: { nome: 'Usuário Teste' },
    };

    await useCase.execute(dto);

    expect(mockTemplateEngine.compile).toHaveBeenCalledWith(
      dto.templateId,
      dto.channel,
      dto.variables,
      dto.recipient,
    );

    expect(mockSenderRegistry.resolve).toHaveBeenCalledWith('remetente-personalizado');

    expect(mockEmailProvider.send).toHaveBeenCalledTimes(1);
    const [compiledMessage, options] = mockEmailProvider.send.mock.calls[0];

    expect(compiledMessage.recipient).toBe('destinatario@example.com');
    expect(compiledMessage.channel).toBe(NotificationChannel.EMAIL);
    expect(options?.sender?.address).toBe('custom@example.com');
    expect(options?.sender?.name).toBe('Custom Sender');
  });

  it('deve compilar template de e-mail e enviar com remetente padrão quando senderId não é informado', async () => {
    const dto: SendNotificationDTO = {
      recipient: 'destinatario@example.com',
      templateId: 'template-email-teste',
      channel: NotificationChannel.EMAIL,
      variables: { nome: 'Usuário Teste' },
    };

    await useCase.execute(dto);

    expect(mockSenderRegistry.resolve).toHaveBeenCalledWith(undefined);
    expect(mockEmailProvider.send).toHaveBeenCalledTimes(1);

    const [, options] = mockEmailProvider.send.mock.calls[0];
    expect(options?.sender?.address).toBe('default@example.com');
    expect(options?.sender?.name).toBe('Default Sender');
  });

  it('deve compilar template de SMS e despachar sem options de remetente', async () => {
    const dto: SendNotificationDTO = {
      recipient: '+5511999999999',
      templateId: 'template-sms-teste',
      channel: NotificationChannel.SMS,
      variables: { codigo: '123456' },
    };

    await useCase.execute(dto);

    expect(mockTemplateEngine.compile).toHaveBeenCalledWith(
      dto.templateId,
      dto.channel,
      dto.variables,
      dto.recipient,
    );

    expect(mockSenderRegistry.resolve).not.toHaveBeenCalled();
    expect(mockSmsProvider.send).toHaveBeenCalledTimes(1);

    const [compiledMessage, options] = mockSmsProvider.send.mock.calls[0];
    expect(compiledMessage.recipient).toBe('+5511999999999');
    expect(compiledMessage.channel).toBe(NotificationChannel.SMS);
    expect(options).toBeUndefined();
  });
});
