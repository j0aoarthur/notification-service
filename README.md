# Notification Service (EDA)

Serviço de Notificações orientado a eventos, construído com arquitetura hexagonal (Clean Architecture) em NestJS, utilizando RabbitMQ como broker de mensagens.

## Arquitetura

O serviço segue os princípios do **Event-Driven Architecture (EDA)** e **Clean Architecture**:
- **Domínio**: Entidades (`NotificationPayload`, `CompiledMessage`), interfaces de provedores e exceções ricas de negócio.
- **Aplicação**: Casos de uso (`ProcessNotificationUseCase`) responsáveis por orquestrar compilação e entrega, DTOs de transporte e `DeliveryProviderRegistry` (Registry Pattern).
- **Apresentação**: `NotificationController` consome eventos nativos do RabbitMQ.
- **Infraestrutura**: Provedores reais (`NodemailerEmailProvider`, `LogSmsProvider`), mecanismos de Template (`HandlebarsTemplateEngine`), conexão com RabbitMQ e mecanismos de DLX/Retry.

## Stack Tecnológica

- **Framework**: NestJS (Microservices)
- **Message Broker**: RabbitMQ
- **Templates**: Handlebars (`hbs`) e `gray-matter` (para front-matter YAML).
- **Provedor de Email**: Nodemailer (testado localmente via MailHog)
- **Linguagem**: TypeScript (modo `strict` ativo)

## Funcionalidades Core

1. **Recepção AMQP Segura**: Escuta em `notifications_queue` com validação estrita baseada em `class-validator`.
2. **Sistema de Templates com Front-Matter**: Parseia o assunto e compila variáveis de personalização em templates `.hbs`.
3. **Registry Pattern para Canais**: Possibilidade de injetar provedores facilmente com base no canal (EMAIL, SMS, PUSH).
4. **Tratamento Seguro de PII**: Senhas, corpos de e-mail compilados, e identificadores completos (como telefones completos ou e-mails inteiros) nunca são registrados no log (regra FR-007).
5. **Retentativas por DLX e TTL**: Fallback embutido com RabbitMQ (usando `x-death` via `notifications_retry_queue` e `notifications_dead_queue`).

## Como Começar

As instruções para rodar o serviço localmente (usando Docker Compose) encontram-se no documento de **Quickstart**.

👉 [Acessar Guia Rápido (Quickstart)](./specs/001-eda-notification-service/quickstart.md)

---
*Projeto gerado utilizando SpecKit e a ferramenta Antigravity.*
