# Notification Service (EDA)

Serviço de Notificações orientado a eventos, construído com **Arquitetura Hexagonal (Clean Architecture)** em **NestJS**, utilizando **RabbitMQ** como broker de mensagens.

Ele atua como um hub centralizado, assíncrono e agnóstico de domínio para envio de mensagens aos usuários do ecossistema de cooperativas (E-mail, SMS, etc.).

## Documentação Completa

Toda a documentação referente a Arquitetura, Integração para Produtores, Variáveis de Ambiente e Guia de Execução Local (Quickstart) foi unificada no manual oficial.

👉 **[Acessar Manual de Integração e Operação](./docs/index.md)**

## Stack Tecnológica

- **Framework**: NestJS (Microservices)
- **Message Broker**: RabbitMQ
- **Templates**: Handlebars (`hbs`) e `gray-matter` (YAML Front-Matter)
- **Provedor de Email**: Nodemailer
- **Linguagem**: TypeScript (`strict` mode)
