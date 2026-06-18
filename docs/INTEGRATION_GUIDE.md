# Guia de Integração — Notification Service

Este guia explica como uma API NestJS existente deve publicar mensagens para o
`notification-service` via RabbitMQ.

---

## Visão Geral da Topologia

```
Sua API  ──publish──▶  notifications_queue  ──consume──▶  notification-service
                               │ (nack)
                               ▼
                  notifications_retry_queue (TTL 30s)
                               │ (TTL expira)
                               ▼
                       notifications_queue  (requeue)
                               │ (max retries excedido)
                               ▼
                  notifications_dead_queue  (DLQ)
```

---

## Contrato da Mensagem

Todo payload publicado na fila deve seguir este formato JSON:

```json
{
  "recipient":  "usuario@empresa.com",
  "templateId": "nome-do-template",
  "channel":    "EMAIL",
  "variables":  {
    "chave": "valor"
  }
}
```

| Campo        | Tipo                   | Obrigatório | Descrição                                              |
|--------------|------------------------|-------------|--------------------------------------------------------|
| `recipient`  | `string`               | ✅          | E-mail ou telefone do destinatário (PII — não logar)   |
| `templateId` | `string` (`/^[a-z0-9-]+$/`) | ✅   | ID do template Handlebars (ex.: `welcome-email`)       |
| `channel`    | `"EMAIL"` ou `"SMS"`   | ✅          | Canal de entrega (ver nota abaixo)                     |
| `variables`  | `object`               | ✅          | Variáveis interpoladas no template (PII — não logar)   |

**Canais suportados pelo enum `NotificationChannel`:**

| Valor   | Status              | Observação                                          |
|---------|---------------------|-----------------------------------------------------|
| `EMAIL` | ✅ Implementado     | Entrega via SMTP (Nodemailer)                       |
| `SMS`   | 🚧 Não implementado | O enum existe, mas o provider de SMS ainda não foi adicionado ao notification-service |

> [!IMPORTANT]
> Os campos `recipient` e `variables` contêm dados pessoais (PII).
> **Nunca** os inclua em logs — mascare ou omita por completo.

---

## Passo a Passo de Integração (NestJS)

### 1. Instalar dependência

```bash
npm install @nestjs/microservices amqplib
```

### 2. Registrar o cliente RabbitMQ no módulo

```typescript
// notification-client.module.ts
import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';

export const NOTIFICATION_CLIENT = 'NOTIFICATION_CLIENT';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: NOTIFICATION_CLIENT,
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBITMQ_URI ?? 'amqp://guest:guest@localhost:5672'],
          queue: 'notifications_queue',
          queueOptions: {
            durable: true,
            arguments: {
              'x-dead-letter-exchange': '',
              'x-dead-letter-routing-key': 'notifications_retry_queue',
            },
          },
          noAck: false,
        },
      },
    ]),
  ],
  exports: [ClientsModule],
})
export class NotificationClientModule {}
```

### 3. Injetar e publicar a mensagem

```typescript
// exemplo: shift.service.ts
import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { NOTIFICATION_CLIENT } from './notification-client.module';

@Injectable()
export class ShiftService {
  constructor(
    @Inject(NOTIFICATION_CLIENT)
    private readonly notificationClient: ClientProxy,
  ) {}

  async notifyShiftAssignment(
    email: string,
    shiftDate: string,
    role: string,
  ): Promise<void> {
    this.notificationClient.emit('notifications_queue', {
      recipient: email,
      templateId: 'shift-assignment',   // deve existir no notification-service
      channel: 'EMAIL',
      variables: { shiftDate, role },
    });
  }
}
```

> [!TIP]
> Use `.emit()` (fire-and-forget) em vez de `.send()` — o notification-service
> é assíncrono e não retorna resposta.

### 4. Adicionar variável de ambiente

```bash
# .env da sua API
RABBITMQ_URI=amqp://guest:guest@localhost:5672
```

---

## Templates Disponíveis

Os templates ficam em `notification-service/src/infrastructure/templates/`.
A estrutura é organizada **por canal** — cada subpasta representa um canal,
e o arquivo `.hbs` dentro dela é nomeado com o `templateId`:

```
templates/
├── email/
│   └── welcome-email.hbs        # templateId = "welcome-email", channel = EMAIL
└── sms/
    └── welcome-sms.hbs          # templateId = "welcome-sms", channel = SMS
```

Para criar um novo template, adicione o arquivo `.hbs` dentro da pasta do
canal correspondente. O nome do arquivo (sem extensão) é o `templateId` que
deve ser enviado no payload.

> [!NOTE]
> Atualmente existe apenas o template `welcome-email` (canal `EMAIL`).
> A pasta `sms/` já está estruturada para receber templates futuros quando o
> provider de SMS for implementado.

---

## Filas Relevantes

| Fila                         | Finalidade                                                     |
|------------------------------|----------------------------------------------------------------|
| `notifications_queue`        | Fila principal — publicar aqui                                 |
| `notifications_retry_queue`  | Retry automático (TTL 30 s, gerenciada pelo notification-service) |
| `notifications_dead_queue`   | Mensagens com falha permanente (> 5 tentativas)                |

---

## Variáveis de Ambiente do Notification Service

Para referência, as variáveis que o serviço precisa estar rodando:

```bash
RABBITMQ_URI=amqp://guest:guest@localhost:5672
RABBITMQ_QUEUE=notifications_queue
RABBITMQ_RETRY_QUEUE=notifications_retry_queue
RABBITMQ_DEAD_QUEUE=notifications_dead_queue
RABBITMQ_RETRY_TTL_MS=30000
RABBITMQ_MAX_RETRIES=5

SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_FROM=noreply@notification-service.local
```

---

## Checklist de Integração

- [ ] `RABBITMQ_URI` configurada no `.env` da sua API
- [ ] `NotificationClientModule` importado no módulo que precisa enviar notificações
- [ ] Template desejado criado em `notification-service/src/infrastructure/templates/`
- [ ] `notification-service` rodando e conectado ao mesmo broker RabbitMQ
- [ ] Logs **não** expõem `recipient` nem `variables`
