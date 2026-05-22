import { DeliveryProviderRegistry } from './delivery-provider-registry.service';
import { DeliveryProvider } from '../../domain/interfaces/delivery-provider.abstract';
import { NotificationChannel } from '../../domain/entities/notification-payload.entity';
import { UnsupportedChannelException } from '../exceptions/unsupported-channel.exception';

describe('DeliveryProviderRegistry', () => {
  let registry: DeliveryProviderRegistry;
  let mockEmailProvider: DeliveryProvider;
  let mockSmsProvider: DeliveryProvider;

  beforeEach(() => {
    mockEmailProvider = {
      channel: NotificationChannel.EMAIL,
      send: jest.fn(),
      isHealthy: jest.fn().mockResolvedValue(true),
    };

    mockSmsProvider = {
      channel: NotificationChannel.SMS,
      send: jest.fn(),
      isHealthy: jest.fn().mockResolvedValue(false), // one unhealthy for coverage
    };

    // O registry recebe o array diretamente — sem DI do NestJS no teste unitário
    registry = new DeliveryProviderRegistry([mockEmailProvider, mockSmsProvider]);
  });

  it('should be defined', () => {
    expect(registry).toBeDefined();
  });

  it('should resolve the correct provider for a given channel', () => {
    const emailProvider = registry.resolve(NotificationChannel.EMAIL);
    expect(emailProvider).toBe(mockEmailProvider);

    const smsProvider = registry.resolve(NotificationChannel.SMS);
    expect(smsProvider).toBe(mockSmsProvider);
  });

  it('should throw UnsupportedChannelException for an unsupported channel', () => {
    expect(() => registry.resolve('PUSH' as NotificationChannel)).toThrow(
      UnsupportedChannelException,
    );
  });

  it('should log healthy and unhealthy status on onModuleInit', async () => {
    // just to check it doesn't throw
    await expect(registry.onModuleInit()).resolves.not.toThrow();
    expect(mockEmailProvider.isHealthy).toHaveBeenCalled();
    expect(mockSmsProvider.isHealthy).toHaveBeenCalled();
  });
});
