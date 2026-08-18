import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { appConfig } from '../config/app.config';
import { SenderRegistry } from '../../domain/interfaces/sender-registry.abstract';
import { EmailSender } from '../../domain/value-objects/email-sender.value-object';
import { UnknownSenderException } from '../../application/exceptions/unknown-sender.exception';

const SENDER_ID_REGEX = /^[a-z0-9-]+$/;
const EMAIL_REGEX = /^[^\s@\r\n]+@[^\s@\r\n]+\.[^\s@\r\n]+$/;
const CRLF_REGEX = /[\r\n]/;

/**
 * Implementação concreta do SenderRegistry, baseada em um arquivo JSON
 * versionado no repositório (`src/infrastructure/config/senders.json`).
 *
 * O arquivo é lido e validado uma única vez em `onModuleInit`. Qualquer
 * violação de schema derruba o boot do Nest (fail-fast) — uma configuração
 * de remetentes quebrada não deve ser descoberta apenas na primeira mensagem
 * da fila.
 *
 * Referência: specs/001-eda-notification-service/spec.md § Sender Identity Resolution
 */
@Injectable()
export class FileSenderRegistry implements SenderRegistry, OnModuleInit {
  private senders: Map<string, EmailSender> = new Map();

  constructor(
    @Inject(appConfig.KEY)
    private readonly config: ConfigType<typeof appConfig>,
  ) {}

  onModuleInit(): void {
    const filePath = this.resolveSendersFilePath();
    const raw = fs.readFileSync(filePath, 'utf8');

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      throw new Error(
        `FileSenderRegistry: falha ao parsear '${filePath}' como JSON: ${(error as Error).message}`,
      );
    }

    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      throw new Error(
        `FileSenderRegistry: o conteúdo de '${filePath}' deve ser um objeto JSON (chave -> identidade).`,
      );
    }

    const senders = new Map<string, EmailSender>();

    for (const [senderId, entry] of Object.entries(
      parsed as Record<string, unknown>,
    )) {
      if (!SENDER_ID_REGEX.test(senderId)) {
        throw new Error(
          `FileSenderRegistry: chave de senderId inválida em '${filePath}': '${senderId}'. ` +
            'Deve conter apenas letras minúsculas, números e hífens.',
        );
      }

      if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
        throw new Error(
          `FileSenderRegistry: entrada inválida para senderId '${senderId}' em '${filePath}': deve ser um objeto.`,
        );
      }

      const { address, name } = entry as { address?: unknown; name?: unknown };

      if (
        typeof address !== 'string' ||
        !EMAIL_REGEX.test(address) ||
        CRLF_REGEX.test(address)
      ) {
        throw new Error(
          `FileSenderRegistry: 'address' inválido para senderId '${senderId}' em '${filePath}'.`,
        );
      }

      if (
        name !== undefined &&
        (typeof name !== 'string' || CRLF_REGEX.test(name))
      ) {
        throw new Error(
          `FileSenderRegistry: 'name' inválido para senderId '${senderId}' em '${filePath}'.`,
        );
      }

      senders.set(senderId, new EmailSender(address, name ?? null));
    }

    this.senders = senders;
  }

  resolve(senderId?: string): EmailSender {
    if (!senderId) {
      return this.defaultSender();
    }

    if (senderId === 'default' && !this.senders.has('default')) {
      return this.defaultSender();
    }

    const sender = this.senders.get(senderId);
    if (sender) {
      return sender;
    }

    throw new UnknownSenderException(senderId);
  }

  private defaultSender(): EmailSender {
    return new EmailSender(
      this.config.email.defaultFrom,
      this.config.email.defaultFromName,
    );
  }

  /**
   * Resolve o caminho do arquivo de remetentes: usa `EMAIL_SENDERS_FILE`
   * quando definido, ou o arquivo padrão versionado no repo. O `__dirname`
   * funciona tanto rodando de `src/` (ts-node/dev) quanto de `dist/` (build),
   * desde que `senders.json` também esteja listado em `assets` no nest-cli.json.
   */
  private resolveSendersFilePath(): string {
    if (this.config.email.sendersFile) {
      return this.config.email.sendersFile;
    }

    return path.resolve(__dirname, '..', 'config', 'senders.json');
  }
}
