import { Test, TestingModule } from '@nestjs/testing';
import { HandlebarsTemplateEngine } from './handlebars-template-engine.service';
import { NotificationChannel } from '../../domain/entities/notification-payload.entity';
import { TemplateNotFoundException } from '../../application/exceptions/template-not-found.exception';
import * as path from 'path';

describe('HandlebarsTemplateEngine', () => {
  let service: HandlebarsTemplateEngine;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HandlebarsTemplateEngine],
    }).compile();

    service = module.get<HandlebarsTemplateEngine>(HandlebarsTemplateEngine);
  });

  it('should compile an existing email template with variables', async () => {
    const compiled = await service.compile(
      'welcome-email',
      NotificationChannel.EMAIL,
      { firstName: 'João' },
      'joao@example.com'
    );

    expect(compiled.recipient).toBe('joao@example.com');
    expect(compiled.channel).toBe(NotificationChannel.EMAIL);
    expect(compiled.subject).toBe('Bem-vindo(a), João!');
    expect(compiled.body).toContain('Olá, João!');
    expect(compiled.body).toContain('<html>'); // Verify HTML content
  });

  it('should compile an existing sms template with variables', async () => {
    const compiled = await service.compile(
      'welcome-sms',
      NotificationChannel.SMS,
      { firstName: 'Maria' },
      '+5511999999999'
    );

    expect(compiled.recipient).toBe('+5511999999999');
    expect(compiled.channel).toBe(NotificationChannel.SMS);
    expect(compiled.subject).toBe('Bem-vindo'); // SMS doesn't strictly need a subject but it's fine if parsed
    expect(compiled.body).toContain('Olá, Maria! Bem-vindo(a) à nossa plataforma.');
  });

  it('should throw TemplateNotFoundException for non-existent template', async () => {
    await expect(
      service.compile(
        'not-found',
        NotificationChannel.EMAIL,
        {},
        'joao@example.com'
      )
    ).rejects.toThrow(TemplateNotFoundException);
  });
});
