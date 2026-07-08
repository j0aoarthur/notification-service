# Manual de Integração e Operação - Notification Service (EDA)

Este é o guia definitivo para implementar, integrar e operar o **Notification Service**. 
Um microserviço orientado a eventos (Event-Driven Architecture) responsável por abstrair e centralizar o envio de notificações multiplataforma (E-mail, SMS, etc.).

---

## 1. Visão Geral e Arquitetura

O serviço segue os princípios do **Event-Driven Architecture (EDA)** e da **Clean Architecture** (Arquitetura Limpa / Hexagonal):

*   **Domínio**: Entidades puras (`NotificationPayload`), *value-objects* e interfaces invertidas de provedores.
*   **Aplicação**: Casos de uso de orquestração e **Registry/Strategy Pattern** para resolver qual provedor de entrega usar sem acoplar regras pesadas ao fluxo principal.
*   **Apresentação**: `NotificationController` como consumidor nativo da mensageria (RabbitMQ).
*   **Infraestrutura**: Motores de templates (Handlebars + front-matter), conexões (amqplib) e os provedores concretos (`NodemailerEmailProvider`, `LogSmsProvider`).

### O Fluxo (Topologia)

A arquitetura garante resiliência e tolerância a falhas utilizando o mecanismo de _Dead Letter Exchange_ (DLX).

```text
Sistema Cliente (Producer) 
       │
     publish
       ▼
notifications_queue ──consume──▶ notification-service ──▶ Provedor (Email/SMS)
       │
    (falha / nack)
       ▼
notifications_retry_queue (Espera de TTL, ex: 30s)
       │
  (TTL expira)
       ▼
notifications_queue (Requeue automático)
       │
(max retries excedido - ex: 5x)
       ▼
notifications_dead_queue (DLQ - Falha permanente)
```

---

## 2. Guia de Execução Local (Quickstart)

### Pré-requisitos
*   Node.js v20+
*   Docker e Docker Compose (para subir RabbitMQ e MailHog)

### Passo a Passo

1.  **Instale as dependências:**
    ```bash
    npm install
    ```
2.  **Configure o ambiente:**
    Crie o `.env` baseado no arquivo de exemplo.
    ```bash
    cp .env.example .env
    ```
3.  **Suba a infraestrutura:**
    Os serviços rodarão em background: RabbitMQ (na porta 5672, UI na 15672) e MailHog (SMTP na 1025, UI na 8025).
    ```bash
    docker-compose up -d rabbitmq mailhog
    ```
4.  **Inicie a aplicação:**
    ```bash
    npm run start:dev
    ```

### Testando a Fila e E-mails
1. Acesse o [RabbitMQ Management UI](http://localhost:15672) (`guest`/`guest`).
2. Na aba **Exchanges** ou **Queues**, publique uma mensagem na fila `notifications_queue` usando o [contrato de payload](#contrato-da-mensagem-payload).
3. Verifique o console da aplicação; a mensagem deve ser processada com sucesso.
4. Acesse o [MailHog UI](http://localhost:8025) e verifique a chegada do e-mail simulado com seu template renderizado.

### Testando Falhas (DLX/DLQ)
Pare o container SMTP (`docker stop notification-mailhog`) e envie uma mensagem. O serviço registrará falha, responderá com `nack` e você verá a mensagem passear entre a `notifications_retry_queue` e a principal até esgotar o limite e cair na `notifications_dead_queue`.

---

## 3. Guia de Integração (Para Sistemas Produtores)

Para usar o Notification Service como hub central a partir do seu sistema base (ex: uma API NestJS), você precisará atuar como **Producer**.

### Contrato da Mensagem (Payload)

Todo payload publicado na fila `notifications_queue` deve seguir o formato JSON abaixo:

```json
{
  "recipient":  "usuario@empresa.com",
  "templateId": "welcome-email",
  "channel":    "EMAIL",
  "variables":  {
    "firstName": "João",
    "activationLink": "https://meu-app.com/ativar/123"
  }
}
```

| Campo        | Tipo | Descrição |
|--------------|------|-----------|
| `recipient`  | `string` | **Obrigatório.** Destinatário final. É dado PII e não deve ser logado por extenso. |
| `templateId` | `string` | **Obrigatório.** O ID do template (nome do arquivo `.hbs` sem extensão). |
| `channel`    | `enum` | **Obrigatório.** `"EMAIL"` ou `"SMS"`. Define qual provedor de entrega rotear. |
| `variables`  | `object` | **Obrigatório.** Variáveis de contexto interpoladas no template. (Dados PII - não logar). |

> [!CAUTION]
> Os campos `recipient` e `variables` contêm dados pessoais (PII - Política FR-007). Ao desenvolver integrações, certifique-se de omiti-los ou mascará-los nos seus logs de negócio.

### Integração com Cliente NestJS (Exemplo)

Instale as dependências: `npm install @nestjs/microservices amqplib`

**Configuração do Módulo (Producer):**
```typescript
import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'NOTIFICATION_CLIENT',
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBITMQ_URI ?? 'amqp://localhost:5672'],
          queue: 'notifications_queue',
          queueOptions: {
            durable: true,
            // Header essencial para injetar na fila no primeiro deploy,
            // mas o notification-service cuida disso primariamente.
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
})
export class NotificationClientModule {}
```

**Disparo de Notificações:**
```typescript
import { Injectable, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

@Injectable()
export class UserService {
  constructor(@Inject('NOTIFICATION_CLIENT') private rmqClient: ClientProxy) {}

  async notifyWelcome(email: string, firstName: string): Promise<void> {
    // Utilize .emit() para comportamento fire-and-forget assíncrono.
    this.rmqClient.emit('notifications_queue', {
      recipient: email,
      templateId: 'welcome-email',
      channel: 'EMAIL',
      variables: { firstName },
    });
  }
}
```

---

## 4. Gerenciamento de Templates

Os templates HTML/Texto são gerenciados via Handlebars (`.hbs`) com suporte a front-matter YAML para metadados (como o `Subject` do e-mail).

A estrutura física dentro do `notification-service` é organizada por canal:

```text
src/infrastructure/templates/
├── email/
│   └── welcome-email.hbs        <-- templateId: "welcome-email"
└── sms/
    └── order-shipped.hbs        <-- templateId: "order-shipped"
```

**Exemplo de template (`welcome-email.hbs`):**
```html
---
subject: Bem-vindo ao sistema, {{firstName}}!
---
<h1>Olá, {{firstName}}</h1>
<p>Seu cadastro foi concluído com sucesso.</p>
```

> [!NOTE]
> Para adicionar novos templates, basta criar o `.hbs` na pasta correspondente ao canal. O nome do arquivo (sem extensão) passará a atuar como a chave de roteamento (`templateId`) exigida na API.

---

## 5. Variáveis de Ambiente e Configuração

As configurações utilizam o injetor do NestJS (arquivo `app.config.ts`) de forma tipada e segura.

| Variável | Descrição | Exemplo |
| :--- | :--- | :--- |
| `RABBITMQ_URI` | URI de conexão AMQP | `amqp://guest:guest@localhost:5672` |
| `RABBITMQ_QUEUE` | Fila principal (Entrada) | `notifications_queue` |
| `RABBITMQ_RETRY_QUEUE` | Fila virtual para *delay* de retry (via TTL) | `notifications_retry_queue` |
| `RABBITMQ_DEAD_QUEUE` | Fila final (DLQ) de descartes permanentes | `notifications_dead_queue` |
| `RABBITMQ_RETRY_TTL_MS` | Tempo do delay de retentativas em MS | `30000` (30 segundos) |
| `RABBITMQ_MAX_RETRIES` | Limite de falhas (header `x-death`) | `5` |
| `SMTP_HOST` | Host do provedor SMTP (Sendgrid, SES, etc) | `localhost` |
| `SMTP_PORT` | Porta do serviço SMTP | `1025` |
| `SMTP_USER` / `SMTP_PASS` | Credenciais do provedor SMTP | *vazio em dev* |
| `SMTP_FROM` | Endereço do remetente | `noreply@empresa.com` |

---

## 6. Checklist de Deploy e Operações

Ao preparar este serviço para o ambiente de Produção:

- [ ] **Variáveis Sensíveis:** Assegure-se de que `SMTP_PASS` e `RABBITMQ_URI` sejam providas de um gerenciador de segredos (Vault, AWS Secrets Manager) e nunca do Git.
- [ ] **Políticas Anti-Spam:** O servidor SMTP alvo de produção deve possuir assinaturas DKIM, DMARC e SPF configuradas na zona DNS para evitar bloqueios nas campanhas.
- [ ] **Monitoramento DLQ:** Configure rotinas ou alarmes no RabbitMQ caso a fila `notifications_dead_queue` comece a acumular mensagens acima de `0`, apontando erros críticos de rede ou templates mal formatados não previstos.
- [ ] **Escalabilidade (Pods):** Devido à confirmação do tipo ACK do RabbitMQ, você pode escalar instâncias do microserviço de forma transparente usando Docker / K8s sem se preocupar com race-conditions no envio de e-mails, o *round-robin* e lock ocorrerão a nível do message broker.
- [ ] **Tratamento de PII**: Valide novamente se você não possui nenhum log.info vazando a tag `variables` (Que frequentemente contém senhas brutas de reset, links confidenciais ou endereços e telefones inteiros). A aplicação já provê o parser `maskRecipient()` internamente.
