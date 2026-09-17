import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as handlebars from 'handlebars';
import matter from 'gray-matter';
import { TemplateEngine } from '../../domain/interfaces/template-engine.abstract';
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
  private static helpersRegistered = false;
  private static partialsRegistered = false;

  constructor() {
    // Caminho base para os templates: <project-root>/src/infrastructure/templates
    this.templatesBasePath = path.resolve(__dirname, '..', 'templates');
    this.registerHelpers();
    this.registerPartials();
  }

  private registerHelpers(): void {
    if (HandlebarsTemplateEngine.helpersRegistered) return;
    HandlebarsTemplateEngine.helpersRegistered = true;

    // Helper: calcula cor de texto com contraste WCAG (YIQ) para fundo dinâmico.
    // Uso: {{contrastColor primaryColor primaryColorForeground}}
    // Se primaryColorForeground for fornecido, usa-o; senão calcula branco/preto.
    handlebars.registerHelper('contrastColor', (bgColor: unknown, fallback: unknown) => {
      if (typeof fallback === 'string' && fallback.trim().length > 0) {
        return fallback.trim();
      }
      if (typeof bgColor !== 'string' || bgColor.trim().length === 0) {
        return '#0B0E1E';
      }
      let hex = bgColor.trim().replace(/^#/, '');
      if (hex.length === 3) {
        hex = hex.split('').map((c) => c + c).join('');
      }
      if (!/^[0-9a-fA-F]{6}$/.test(hex)) {
        return '#0B0E1E';
      }
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      // YIQ — threshold 128 (W3C)
      const yiq = (r * 299 + g * 587 + b * 114) / 1000;
      return yiq >= 128 ? '#0B0E1E' : '#FFFFFF';
    });

    // Helper sem args que lê primaryColorForeground / primaryColor do contexto
    handlebars.registerHelper('ctaTextColor', function (this: Record<string, unknown>) {
      const fg = this['primaryColorForeground'];
      if (typeof fg === 'string' && fg.trim().length > 0) {
        return fg.trim();
      }
      const bg = this['primaryColor'];
      if (typeof bg !== 'string' || bg.trim().length === 0) return '#0B0E1E';
      let hex = bg.trim().replace(/^#/, '');
      if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
      if (!/^[0-9a-fA-F]{6}$/.test(hex)) return '#0B0E1E';
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      const yiq = (r * 299 + g * 587 + b * 114) / 1000;
      return yiq >= 128 ? '#0B0E1E' : '#FFFFFF';
    });
  }

  private registerPartials(): void {
    if (HandlebarsTemplateEngine.partialsRegistered) return;
    HandlebarsTemplateEngine.partialsRegistered = true;
    try {
      const partialsDir = path.join(this.templatesBasePath, 'partials');
      if (!fs.existsSync(partialsDir)) return;
      const files = fs.readdirSync(partialsDir);
      for (const file of files) {
        if (file.endsWith('.hbs')) {
          const partialName = path.basename(file, '.hbs');
          const content = fs.readFileSync(path.join(partialsDir, file), 'utf8');
          handlebars.registerPartial(partialName, content);
        }
      }
    } catch {
      // Parciais são opcionais — falha silenciosa mantém compatibilidade
    }
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
      compiledSubject = subjectCompiler(variables).trim();
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
