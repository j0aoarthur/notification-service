import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { appConfig } from './infrastructure/config/app.config';

/**
 * Módulo raiz da aplicação.
 * As importações dos módulos de domínio e infraestrutura serão adicionadas nas fases seguintes.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
    }),
  ],
})
export class AppModule {}
