# Guia: Configurando um Novo Cliente no Notification Service

Este guia cobre o ciclo completo de integração de um novo cliente (tenant) ao notification-service: desde a criação dos templates em ambiente local até o deploy em produção na VPS.

> Usa `atlee` como identificador de exemplo ao longo de todo o guia. Substitua pelo identificador real do seu cliente (`^[a-z0-9-]+$`).

---

## Fase 1 — Desenvolvimento Local

### Passo 1 — Suba a infraestrutura

```bash
docker-compose up -d rabbitmq mailhog
npm run start:dev
```

| Serviço | URL |
|---|---|
| RabbitMQ Management | http://localhost:15672 (`guest`/`guest`) |
| MailHog (captura e-mails) | http://localhost:8025 |

---

### Passo 2 — Crie os templates do cliente

Crie um arquivo `.hbs` para cada tipo de notificação. O nome do arquivo **é** o `templateId`. Use o prefixo do cliente para isolar do restante.

```text
src/infrastructure/templates/
└── email/
    ├── atlee-welcome-email.hbs
    └── atlee-password-reset.hbs
```

**Estrutura do template:**

```handlebars
---
subject: "Bem-vindo(a) à Atlee, {{firstName}}!"
---
<html>
  <body>
    <h1>Olá, {{firstName}}!</h1>
    <p>Sua conta na Atlee foi criada com sucesso.</p>
    <a href="{{activationLink}}">Ativar minha conta</a>
  </body>
</html>
```

- O bloco `---` é o **front-matter YAML** — define o `subject` do e-mail. Também aceita `{{variáveis}}`.
- O conteúdo abaixo do front-matter é o **body HTML**, compilado via Handlebars.

> [!CAUTION]
> Use sempre `{{ }}` (não `{{{ }}}`) com dados vindos do usuário. O Handlebars escapa HTML automaticamente com a sintaxe de duplas chaves, prevenindo injeção de conteúdo no cliente de e-mail do destinatário.

---

### Passo 3 — (Opcional) Registre o remetente do cliente

Se o cliente precisa de um endereço `From` próprio, adicione uma entrada em `src/infrastructure/config/senders.json`:

```json
{
  "atlee": {
    "address": "no-reply@atlee.com.br",
    "name": "Atlee"
  }
}
```

O campo `name` é **opcional** — quando omitido, o cabeçalho `From` conterá apenas o endereço.

> [!IMPORTANT]
> Qualquer entrada inválida (e-mail malformado, CRLF no nome, chave fora do padrão `^[a-z0-9-]+$`) derruba o boot do serviço — valide antes de salvar.

Após editar o arquivo, reinicie o serviço para que o `FileSenderRegistry` releia o `senders.json`:

```bash
# Rodando via npm run start:dev — o hot-reload cuida automaticamente.

# Rodando via docker-compose:
docker compose restart notification-service
```

---

### Passo 4 — Teste com o script de publicação

Use o `scripts/publish.js` para publicar mensagens diretamente na fila sem precisar de uma aplicação cliente:

```bash
# Teste básico — usa o remetente padrão (MAIL_FROM)
node scripts/publish.js \
  --template atlee-welcome-email \
  --channel EMAIL \
  --recipient voce@seudominio.com \
  --var firstName="João"

# Com remetente próprio do cliente (senderId)
node scripts/publish.js \
  --template atlee-welcome-email \
  --channel EMAIL \
  --recipient voce@seudominio.com \
  --sender atlee \
  --var firstName="João" \
  --var activationLink="https://atlee.com.br/ativar/abc123"
```

**O que verificar após publicar:**

| Onde | O que esperar |
|---|---|
| Terminal do serviço | `Template compilado com sucesso \| templateId: atlee-welcome-email` |
| MailHog (http://localhost:8025) | E-mail capturado com subject e body corretos |
| RabbitMQ (http://localhost:15672) | Fila `notifications_queue` vazia (mensagem consumida) |

---

### Passo 5 — Teste de falha (DLX/DLQ)

Valide que o mecanismo de retry e dead-letter funcionam antes de ir para produção.

```bash
# Para o MailHog para simular falha de SMTP
docker stop notification-mailhog

# Publica uma mensagem — vai falhar e entrar no ciclo de retry
node scripts/publish.js \
  --template atlee-welcome-email \
  --recipient teste@atlee.com.br \
  --var firstName="Teste"
```

Acompanhe no RabbitMQ Management (http://localhost:15672):

```text
notifications_queue  →  (falha, nack)
        ↓
notifications_retry_queue  →  (aguarda 30s TTL)
        ↓
notifications_queue  →  (tenta de novo)
        ↓
... repete até 5 falhas ...
        ↓
notifications_dead_queue  (falha permanente — mensagem preservada para inspeção)
```

Restaure o MailHog ao terminar:

```bash
docker start notification-mailhog
```

---

### Passo 6 — Integre a aplicação cliente (Producer)

Na API do cliente que vai publicar notificações, use o contrato abaixo:

**Exemplo NestJS com `ClientProxy`:**

```typescript
this.rmqClient.emit('notifications_queue', {
  recipient: user.email,           // PII — nunca logar diretamente
  templateId: 'atlee-welcome-email',
  channel: 'EMAIL',
  senderId: 'atlee',              // opcional — omita para usar MAIL_FROM padrão
  variables: {                    // PII — nunca logar diretamente
    firstName: user.firstName,
    activationLink: `https://atlee.com.br/ativar/${token}`,
  },
});
```

> [!CAUTION]
> **Nunca logue `variables` ou `recipient` diretamente** — contêm dados pessoais (PII). O notification-service já mascara `recipient` internamente (`***@dominio.com`), mas sua aplicação também deve respeitar essa política nos seus próprios logs.

Para stacks não-NestJS (Python, Go, Node puro), monte o envelope manualmente antes de publicar:

```json
{
  "pattern": "notifications_queue",
  "data": {
    "recipient": "usuario@atlee.com.br",
    "templateId": "atlee-welcome-email",
    "channel": "EMAIL",
    "senderId": "atlee",
    "variables": { "firstName": "Maria" }
  }
}
```

O `@EventPattern('notifications_queue')` do `NotificationController` só reconhece mensagens com esse envelope. Sem ele, a mensagem chega na fila mas não é processada.

---

## Fase 2 — Produção (VPS)

### Passo 7 — PR, merge e sincronização na VPS

As mudanças de conteúdo (templates + `senders.json`) seguem o fluxo normal de código:

1. Abra um PR com os novos arquivos
2. Revise e faça merge em `main`
3. Na VPS, sincronize:

```bash
cd /srv/notification-service && git pull
```

| O que mudou | Ação necessária |
|---|---|
| Apenas templates (`.hbs`) | Nenhuma — são lidos do disco a cada mensagem |
| `senders.json` | `docker compose restart notification-service` |
| Código do serviço (novo provider, dependência) | `docker compose build notification-service && docker compose up -d` |

---

### Passo 8 — Verifique o domínio (somente se `EMAIL_PROVIDER=resend`)

O Resend só entrega e-mails a partir de um **domínio verificado** com SPF e DKIM configurados. O endereço em `senders.json` (`no-reply@atlee.com.br`) precisa pertencer a esse domínio.

- [ ] Domínio adicionado e verificado no painel do Resend (https://resend.com/domains)
- [ ] Registro SPF configurado na zona DNS do domínio
- [ ] Registro DKIM configurado na zona DNS do domínio
- [ ] `RESEND_API_KEY` definido no `.env` da VPS

---

## Resumo do fluxo completo

```text
┌─────────────── Dev Local ─────────────────┐
│                                            │
│  1. docker-compose up (RabbitMQ + MailHog) │
│  2. Criar templates  → templates/email/    │
│  3. Registrar sender → senders.json        │
│     └── restart do serviço                 │
│  4. Testar → publish.js → verificar MailHog│
│  5. Testar falha → verificar DLX/DLQ       │
│  6. Integrar aplicação cliente (Producer)  │
│                                            │
└──────────────────┬─────────────────────────┘
                   │  PR + merge em main
┌──────────────────▼──────── VPS ────────────┐
│                                            │
│  7. git pull → templates hot-reload        │
│     └── (se senders.json) restart          │
│  8. (se Resend) verificar domínio DNS      │
│                                            │
└────────────────────────────────────────────┘
```
