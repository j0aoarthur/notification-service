# Quickstart: EDA Notification Service

## Prerequisites
- Node.js v20+
- Docker e Docker Compose (provê RabbitMQ e MailHog)

1. Clone o repositório e instale as dependências:
   ```bash
   npm install
   ```

2. Crie um arquivo `.env` baseado no `.env.example`:
   ```bash
   cp .env.example .env
   ```

3. Suba a infraestrutura local (RabbitMQ e MailHog):
   ```bash
   docker-compose up -d
   ```

4. Rode o servidor em modo de desenvolvimento:
   ```bash
   npm run start:dev
   ```

## Testando o fluxo completo

O Docker Compose sobe dois serviços cruciais:
1. **RabbitMQ Management UI**: [http://localhost:15672](http://localhost:15672) (guest / guest)
2. **MailHog Web UI**: [http://localhost:8025](http://localhost:8025) (Sem autenticação)

Para publicar uma mensagem diretamente na fila, acesse a aba `Queues`, clique em `notifications_queue`, expanda `Publish message` e envie o seguinte payload na seção `Payload`:

```json
{
  "templateId": "welcome-email",
  "channel": "EMAIL",
  "recipient": "user@cooperativa.com",
  "variables": {
    "firstName": "João"
  }
}
```

Vá até o painel do MailHog ([http://localhost:8025](http://localhost:8025)) e verifique se o e-mail chegou com o assunto `Bem-vindo(a), João!` e o template renderizado.

## Testando Falhas e Retentativas (DLX/DLQ)

Para simular o mecanismo de _Dead Letter Exchange_ e TTL:
1. Pare o container do MailHog: `docker stop notification-mailhog`.
2. Envie uma notificação por e-mail no RabbitMQ UI.
3. Observe os logs da aplicação. A aplicação tentará entregar, falhará (já que o servidor SMTP está inacessível), e enviará um `nack`.
4. A mensagem ficará na fila `notifications_retry_queue` pelo tempo configurado no TTL e depois voltará para a `notifications_queue`.
5. Após atingir o limite de retentativas (padrão: **5 tentativas**, configurável em `RABBITMQ_MAX_RETRIES`), ela será roteada permanentemente para a fila `notifications_dead_queue`.
