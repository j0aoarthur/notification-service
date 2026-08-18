import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { ConfigType } from '@nestjs/config';
import { FileSenderRegistry } from './file-sender-registry.service';
import { appConfig } from '../config/app.config';
import { UnknownSenderException } from '../../application/exceptions/unknown-sender.exception';

function buildConfig(sendersFile: string): ConfigType<typeof appConfig> {
  return {
    email: {
      defaultFrom: 'noreply@example.com',
      defaultFromName: 'Default Sender',
      sendersFile,
    },
  } as unknown as ConfigType<typeof appConfig>;
}

function writeFixture(content: unknown): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sender-registry-'));
  const filePath = path.join(dir, 'senders.json');
  fs.writeFileSync(
    filePath,
    typeof content === 'string' ? content : JSON.stringify(content),
  );
  return filePath;
}

describe('FileSenderRegistry', () => {
  it('resolve() sem senderId retorna o default do config', () => {
    const filePath = writeFixture({});
    const registry = new FileSenderRegistry(buildConfig(filePath));
    registry.onModuleInit();

    const sender = registry.resolve();
    expect(sender.address).toBe('noreply@example.com');
    expect(sender.name).toBe('Default Sender');
  });

  it("resolve('default') sem entrada no arquivo retorna o mesmo default", () => {
    const filePath = writeFixture({});
    const registry = new FileSenderRegistry(buildConfig(filePath));
    registry.onModuleInit();

    const sender = registry.resolve('default');
    expect(sender.address).toBe('noreply@example.com');
    expect(sender.name).toBe('Default Sender');
  });

  it('resolve() com senderId existente retorna o EmailSender correspondente', () => {
    const filePath = writeFixture({
      suporte: { address: 'suporte@example.com', name: 'Suporte' },
    });
    const registry = new FileSenderRegistry(buildConfig(filePath));
    registry.onModuleInit();

    const sender = registry.resolve('suporte');
    expect(sender.address).toBe('suporte@example.com');
    expect(sender.name).toBe('Suporte');
  });

  it("'default' explícito com entrada override no arquivo usa a entrada do arquivo", () => {
    const filePath = writeFixture({
      default: {
        address: 'default-custom@example.com',
        name: 'Custom Default',
      },
    });
    const registry = new FileSenderRegistry(buildConfig(filePath));
    registry.onModuleInit();

    const sender = registry.resolve('default');
    expect(sender.address).toBe('default-custom@example.com');
  });

  it('resolve() com senderId desconhecido lança UnknownSenderException', () => {
    const filePath = writeFixture({});
    const registry = new FileSenderRegistry(buildConfig(filePath));
    registry.onModuleInit();

    expect(() => registry.resolve('inexistente')).toThrow(
      UnknownSenderException,
    );
  });

  it('onModuleInit() com JSON inválido lança', () => {
    const filePath = writeFixture('{ isso nao é json');
    const registry = new FileSenderRegistry(buildConfig(filePath));

    expect(() => registry.onModuleInit()).toThrow();
  });

  it('onModuleInit() com chave fora do padrão lança', () => {
    const filePath = writeFixture({
      'Suporte_Invalido!': { address: 'suporte@example.com' },
    });
    const registry = new FileSenderRegistry(buildConfig(filePath));

    expect(() => registry.onModuleInit()).toThrow();
  });

  it('onModuleInit() com address inválido lança', () => {
    const filePath = writeFixture({
      suporte: { address: 'nao-e-email' },
    });
    const registry = new FileSenderRegistry(buildConfig(filePath));

    expect(() => registry.onModuleInit()).toThrow();
  });

  it('onModuleInit() com conteúdo raiz que não é objeto lança', () => {
    const filePath = writeFixture(['array', 'nao', 'permitido']);
    const registry = new FileSenderRegistry(buildConfig(filePath));

    expect(() => registry.onModuleInit()).toThrow();
  });
});
