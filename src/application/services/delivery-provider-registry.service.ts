import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  DELIVERY_PROVIDERS,
  DeliveryProvider,
} from '../../domain/interfaces/delivery-provider.interface';
import { NotificationChannel } from '../../domain/entities/notification-payload.entity';
import { UnsupportedChannelException } from '../exceptions/unsupported-channel.exception';
import type { OnModuleInit } from '@nestjs/common';

/**
 * Registry Pattern para Delivery Providers.
 *
 * Responsável por injetar dinamicamente a implementação correta de DeliveryProvider
 * com base no `channel` da notificação compilada.
 *
 * Referência: specs/001-eda-notification-service/spec.md § User Story 3
 */
@Injectable()
export class DeliveryProviderRegistry implements OnModuleInit {
  private readonly logger = new Logger(DeliveryProviderRegistry.name);
  private readonly providersMap = new Map<NotificationChannel, DeliveryProvider>();

  constructor(
    @Inject(DELIVERY_PROVIDERS)
    private readonly providers: DeliveryProvider[],
  ) {
    // Registra cada provider no mapa pelo seu canal
    for (const provider of this.providers) {
      this.providersMap.set(provider.channel, provider);
    }
  }

  /**
   * Verifica a saúde de todos os providers registrados no momento da inicialização.
   */
  async onModuleInit() {
    this.logger.log(
      `Inicializando DeliveryProviderRegistry com ${this.providers.length} provider(s)`,
    );

    for (const provider of this.providers) {
      try {
        const isHealthy = await provider.isHealthy();
        if (isHealthy) {
          this.logger.log(`Provider para canal '${provider.channel}' está SAUDÁVEL.`);
        } else {
          this.logger.warn(`Provider para canal '${provider.channel}' NÃO ESTÁ SAUDÁVEL.`);
        }
      } catch (error: unknown) {
        const err = error instanceof Error ? error.message : 'Desconhecido';
        this.logger.error(
          `Falha ao verificar saúde do provider para canal '${provider.channel}': ${err}`,
        );
      }
    }
  }

  /**
   * Resolve o provider apropriado para o canal especificado.
   *
   * @throws {UnsupportedChannelException} Se nenhum provider for encontrado para o canal.
   */
  resolve(channel: NotificationChannel): DeliveryProvider {
    const provider = this.providersMap.get(channel);

    if (!provider) {
      const supportedChannels = Array.from(this.providersMap.keys());
      throw new UnsupportedChannelException(channel, supportedChannels);
    }

    return provider;
  }
}
