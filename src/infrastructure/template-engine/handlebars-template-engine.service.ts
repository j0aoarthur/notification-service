import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as handlebars from 'handlebars';
import matter from 'gray-matter';
import { TemplateEngine } from '../../domain/interfaces/template-engine';
import { NotificationChannel } from '../../domain/entities/notification-payload.entity';
import { CompiledMessage } from '../../domain/value-objects/compiled-message.value-object';
import { TemplateNotFoundException } from '../../application/exceptions/template-not-found.exception';

/**
 * Motor de compilação de templates usando Handlebars e gray-matter.
 *
 * Busca arquivos `.hbs` físicos dentro de `src/infrastructure/templates/{channel}/{templateId}.hbs`.
 * Usa `gray-matter` para extrair variáveis fixas do front-matter YAML (ex.: subject)
 * e compila o body utilizando Handlebars.
 *
 * Referência: specs/001-eda-notification-service/spec.md § User Story 2
 */
@Injectable()
export class HandlebarsTemplateEngine implements TemplateEngine {
  private readonly templatesBasePath: string;

  constructor() {
    // Caminho base para os templates: <project-root>/src/infrastructure/templates
    this.templatesBasePath = path.resolve(__dirname, '..', 'templates');
  }

  async compile(
    templateId: string,
    channel: NotificationChannel,
    variables: Record<string, unknown>,
    recipient: string,
  ): Promise<CompiledMessage> {
    const templatePath = this.getTemplatePath(templateId, channel);

    if (!fs.existsSync(templatePath)) {
      throw new TemplateNotFoundException(templateId, channel);
    }

    const fileContent = fs.readFileSync(templatePath, 'utf8');

    // Extrai o front-matter (data) e o corpo do template (content)
    const { data: frontMatter, content: templateBody } = matter(fileContent);

    // Compila os templates usando Handlebars (tanto para o body quanto para atributos como subject)
    const bodyCompiler = handlebars.compile(templateBody);
    const compiledBody = bodyCompiler(variables);

    let compiledSubject: string | undefined = undefined;

    // Se houver "subject" no front-matter, nós o compilamos também (para permitir {{firstName}} no assunto)
    if (frontMatter.subject && typeof frontMatter.subject === 'string') {
      const subjectCompiler = handlebars.compile(frontMatter.subject);
      compiledSubject = subjectCompiler(variables);
    }

    return new CompiledMessage(recipient, channel, compiledSubject || null, compiledBody);
  }

  /**
   * Resolve o caminho absoluto do arquivo .hbs baseado no canal.
   * Ex: EMAIL -> 'email', SMS -> 'sms'
   */
  private getTemplatePath(
    templateId: string,
    channel: NotificationChannel,
  ): string {
    const channelFolder = channel.toLowerCase();
    return path.join(this.templatesBasePath, channelFolder, `${templateId}.hbs`);
  }
}
