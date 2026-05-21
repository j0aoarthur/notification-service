import { Test, TestingModule } from '@nestjs/testing';
import { NotificationController } from './notification.controller';
import { ProcessNotificationUseCase } from '../../application/use-cases/process-notification.use-case';
import { appConfig } from '../../infrastructure/config/app.config';
import { MetricsService } from '../../infrastructure/metrics/metrics.service';
import { RmqContext } from '@nestjs/microservices';
import { SendNotificationDTO } from '../../application/dtos/send-notification.dto';
import { NotificationChannel } from '../../domain/entities/notification-payload.entity';

describe('NotificationController (Retries & DLQ)', () => {
  let controller: NotificationController;
  let useCase: ProcessNotificationUseCase;

  const mockChannel = {
    ack: jest.fn(),
    nack: jest.fn(),
    sendToQueue: jest.fn(),
  };

  const mockConfig = {
    rabbitmq: {
      queue: 'notifications_queue',
      retryQueue: 'notifications_retry_queue',
      deadQueue: 'notifications_dead_queue',
      maxRetries: 3,
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationController],
      providers: [
        {
          provide: ProcessNotificationUseCase,
          useValue: { execute: jest.fn() },
        },
        {
          provide: appConfig.KEY,
          useValue: mockConfig,
        },
        {
          provide: MetricsService,
          useValue: {
            recordSuccess: jest.fn(),
            recordFailure: jest.fn(),
            recordRetry: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<NotificationController>(NotificationController);
    useCase = module.get<ProcessNotificationUseCase>(ProcessNotificationUseCase);
  });

  const createMockContext = (xDeath?: any[]): RmqContext => {
    return {
      getChannelRef: () => mockChannel,
      getMessage: () => ({
        content: Buffer.from('test'),
        properties: {
          headers: xDeath ? { 'x-death': xDeath } : {},
        },
      }),
    } as unknown as RmqContext;
  };

  const dto: SendNotificationDTO = {
    templateId: 'test_template',
    channel: NotificationChannel.EMAIL,
    recipient: 'test@example.com',
    variables: {},
  };

  it('should process successfully and ack when x-death is empty', async () => {
    const ctx = createMockContext();
    await controller.handleNotification(dto, ctx);
    
    expect(useCase.execute).toHaveBeenCalledWith(dto);
    expect(mockChannel.ack).toHaveBeenCalled();
    expect(mockChannel.nack).not.toHaveBeenCalled();
  });

  it('should nack with requeue:false if use case fails and count < maxRetries', async () => {
    const ctx = createMockContext([{ queue: 'notifications_queue', count: 1 }]);
    jest.spyOn(useCase, 'execute').mockRejectedValue(new Error('Provider failure'));
    
    await controller.handleNotification(dto, ctx);
    
    expect(useCase.execute).toHaveBeenCalledWith(dto);
    expect(mockChannel.nack).toHaveBeenCalledWith(expect.anything(), false, false);
    expect(mockChannel.sendToQueue).not.toHaveBeenCalled();
  });

  it('should send to DLQ and ack if count >= maxRetries', async () => {
    const ctx = createMockContext([{ queue: 'notifications_queue', count: 3 }]);
    
    await controller.handleNotification(dto, ctx);
    
    expect(useCase.execute).not.toHaveBeenCalled();
    expect(mockChannel.sendToQueue).toHaveBeenCalledWith(
      'notifications_dead_queue',
      Buffer.from('test'),
      expect.any(Object)
    );
    expect(mockChannel.ack).toHaveBeenCalled();
  });
});
