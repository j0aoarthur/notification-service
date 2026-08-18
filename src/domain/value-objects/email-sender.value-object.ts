const EMAIL_REGEX = /^[^\s@\r\n]+@[^\s@\r\n]+\.[^\s@\r\n]+$/;
const CRLF_REGEX = /[\r\n]/;

/**
 * Value Object que representa uma identidade de remetente de e-mail
 * (endereço + nome de exibição opcional), já validada.
 *
 * Este VO só deve ser construído a partir de fontes confiáveis (config
 * carregada no boot, arquivo `senders.json` validado) — NUNCA a partir de
 * uma string de e-mail livre vinda do cliente. Por isso a validação lança
 * `Error` comum: uma identidade inválida deve derrubar o boot do serviço
 * (fail-fast), não ser tratada como erro de negócio recuperável.
 *
 * Referência: specs/001-eda-notification-service/data-model.md § EmailSender
 */
export class EmailSender {
  readonly address: string;
  readonly name: string | null;

  constructor(address: string, name: string | null = null) {
    if (!EMAIL_REGEX.test(address)) {
      throw new Error(
        `EmailSender: endereço de e-mail inválido: '${address}'.`,
      );
    }

    if (CRLF_REGEX.test(address)) {
      throw new Error(
        'EmailSender: address não pode conter caracteres de quebra de linha (CR/LF).',
      );
    }

    if (name !== null && CRLF_REGEX.test(name)) {
      throw new Error(
        'EmailSender: name não pode conter caracteres de quebra de linha (CR/LF).',
      );
    }

    this.address = address;
    this.name = name;
  }

  /**
   * Formata a identidade no padrão RFC 5322 usado no cabeçalho `From`.
   * Sem nome, retorna apenas o endereço. Com nome, retorna
   * `"Nome Escapado" <endereco@dominio.com>`.
   */
  toRfc5322(): string {
    if (!this.name) {
      return this.address;
    }

    const escapedName = this.name.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return `"${escapedName}" <${this.address}>`;
  }
}
