import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

/**
 * Ponto de entrada da aplicação.
 * O transporte RmqTransport e demais configurações de microserviço
 * serão adicionados na Phase 2 (T017).
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  await app.listen(3000);
}

void bootstrap();
