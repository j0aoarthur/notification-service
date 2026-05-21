/**
 * Value Object que representa um template de notificação carregado do filesystem.
 * Nunca é persistido em banco de dados — é resolvido do disco a cada mensagem.
 *
 * Convenção de armazenamento:
 *   src/infrastructure/templates/{channel}/{templateId}.hbs
 *
 * Formato do arquivo .hbs (front-matter YAML + corpo Handlebars):
 *   ---
 *   subject: "Bem-vindo, {{firstName}}!"
 *   ---
 *   <p>Olá, {{firstName}}! Sua conta foi criada com sucesso.</p>
 *
 * Referência: specs/001-eda-notification-service/data-model.md § NotificationTemplate
 */
export class NotificationTemplate {
  /** Identificador do template — corresponde ao templateId do payload */
  readonly id: string;

  /** Linha de assunto compilável (usada no canal EMAIL; ignorada no SMS) */
  readonly subject: string;

  /** Corpo do template Handlebars (ainda não compilado) */
  readonly body: string;

  constructor(id: string, subject: string, body: string) {
    this.id = id;
    this.subject = subject;
    this.body = body;
  }
}
