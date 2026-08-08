import { EmailSender } from './email-sender.value-object';

describe('EmailSender', () => {
  describe('toRfc5322', () => {
    it('deve retornar apenas o address quando não há name', () => {
      const sender = new EmailSender('noreply@example.com');
      expect(sender.toRfc5322()).toBe('noreply@example.com');
    });

    it('deve retornar "name" <address> quando há name', () => {
      const sender = new EmailSender('noreply@example.com', 'Equipe Suporte');
      expect(sender.toRfc5322()).toBe('"Equipe Suporte" <noreply@example.com>');
    });

    it('deve escapar aspas duplas no name', () => {
      const sender = new EmailSender('noreply@example.com', 'Time "Alpha"');
      expect(sender.toRfc5322()).toBe(
        '"Time \\"Alpha\\"" <noreply@example.com>',
      );
    });

    it('deve escapar barras invertidas no name antes das aspas', () => {
      const sender = new EmailSender(
        'noreply@example.com',
        'C:\\Suporte "VIP"',
      );
      expect(sender.toRfc5322()).toBe(
        '"C:\\\\Suporte \\"VIP\\"" <noreply@example.com>',
      );
    });
  });

  describe('validação', () => {
    it('deve lançar se address for mal formado', () => {
      expect(() => new EmailSender('nao-e-email')).toThrow();
    });

    it('deve lançar se address contiver \\r ou \\n', () => {
      expect(() => new EmailSender('a@b.com\r\nBcc: evil@x.com')).toThrow();
    });

    it('deve lançar se name contiver \\r ou \\n', () => {
      expect(
        () => new EmailSender('a@b.com', 'Nome\r\nBcc: evil@x.com'),
      ).toThrow();
    });

    it('não deve lançar para um address e name válidos', () => {
      expect(() => new EmailSender('a@b.com', 'Nome Válido')).not.toThrow();
    });
  });
});
