# Guia de Integração em VPS — Múltiplas Aplicações Clientes

Este guia cobre o cenário: você tem (ou terá) várias aplicações próprias
publicando notificações neste serviço, e quer rodar tudo numa VPS via
Docker Compose, junto com sua API principal.

> Se você só quer o contrato de mensagem e os passos básicos de execução
> local, veja [`docs/index.md`](./index.md). Este guia foca em **deploy em
> produção** e em **como lidar com várias aplicações clientes** sem virar
> um pesadelo de manutenção.

---

## 1. Por que não usar uma branch por aplicação cliente

A tentação é: cada app cliente (cada "tenant") ganha uma branch remota,
e os templates daquele app vivem só ali. Não recomendamos isso:

- **Toda correção do serviço vira trabalho manual N vezes.** Uma branch que
  nunca dá merge em `main` não é branching, é fork permanente — um fix de
  segurança ou uma nova feature no serviço central precisa ser replicado
  (cherry-pick) em cada branch, uma por uma. Esqueceu uma, aquele cliente
  fica desatualizado.
- **Branch não é controle de acesso.** Qualquer pessoa com push no repo
  mexe na branch de qualquer cliente.
- **Build/deploy vira "branch-aware"**, exigindo trocar de branch ou manter
  N pipelines só para servir conteúdo diferente — desnecessário quando o
  *código* do serviço é o mesmo para todo mundo.
- Mistura duas coisas com ciclo de vida diferente: **código** (muda raro,
  passa por PR/CI) e **conteúdo** (templates, remetentes — muda toda hora,
  a pedido do negócio).

## 2. O modelo adotado

Pergunta que decide tudo: os "tenants" são aplicações **suas** publicando na
mesma fila, ou clientes externos que exigem isolamento real de
infraestrutura (SMTP próprio, compliance, etc.)? Neste guia assumimos o
primeiro caso — e a resposta é **uma única instância do notification-service
atendendo todas as aplicações**, não uma implantação por cliente.

- **Isolamento por app = convenção de nome, não infraestrutura separada.**
  Prefixe o `templateId` com um identificador curto do app:
  `appa-welcome-email`, `appb-order-shipped`. Isso já funciona **sem
  nenhuma mudança de código** — o resolver de templates
  (`src/infrastructure/template-engine/handlebars-template-engine.service.ts`)
  e a validação do DTO (`^[a-z0-9-]+$` em
  `src/application/dtos/send-notification.dto.ts`) já aceitam qualquer
  string nesse formato.
- **Remetente por app, se precisar**, via `senderId` (feature já implementada
  — veja `src/infrastructure/config/senders.json` e
  `src/infrastructure/senders/file-sender-registry.service.ts`): cada app
  ganha uma entrada no registry com seu próprio endereço/nome de exibição.
  Sem `senderId`, cai no remetente padrão do serviço.
- **Todo esse conteúdo (templates + `senders.json`) continua versionado na
  `main` deste repo**, via PR normal. O que muda em produção é *como* esse
  conteúdo chega até a VPS — ver seção 5.

## 3. Topologia na VPS

```text
┌─────────────────────────────── VPS ───────────────────────────────┐
│                                                                     │
│   Internet ──▶ [Sua API principal] (única porta pública)          │
│                        │                                           │
│                     publish (AMQP)                                 │
│                        ▼                                           │
│                  [RabbitMQ]  ◀── rede Docker interna, sem porta    │
│                        │           exposta publicamente            │
│                     consume                                        │
│                        ▼                                           │
│              [notification-service]  ◀── sem porta HTTP nenhuma;   │
│                        │                  é um worker puro de fila │
│                        ▼                                           │
│                  SMTP / Resend (saída para internet)               │
└─────────────────────────────────────────────────────────────────┘
```

Confirmado em `src/main.ts`: o serviço sobe via `NestFactory.createMicroservice`
(não `create`), então **não existe servidor HTTP nenhum a expor** — só
precisa alcançar o RabbitMQ.

## 4. Passo 1 — Preparar o diretório de conteúdo na VPS

O código (imagem Docker) e o conteúdo (templates/remetentes) têm ciclos de
atualização diferentes — trate-os separado desde o início:

```bash
mkdir -p /srv/notification-service
git clone <url-deste-repo> /srv/notification-service
cd /srv/notification-service
```

Esse checkout é a fonte do conteúdo que será montado dentro do container
(seção 5). Atualizar templates ou remetentes em produção, depois do deploy
inicial, é só:

```bash
cd /srv/notification-service && git pull
```

> [!NOTE]
> `.hbs` são lidos do disco a cada mensagem processada — `git pull` já
> basta, nenhum restart necessário. Já `senders.json` é carregado **uma
> única vez**, no boot (`onModuleInit` do `FileSenderRegistry`, fail-fast por
> design) — se editar esse arquivo, rode
> `docker compose restart notification-service` para o serviço reler.

## 5. Passo 2 — Adicionar ao `docker-compose` do seu projeto

Adicione os serviços de `docker-compose.yml` deste repo ao compose da sua
API principal (ou mantenha um `docker-compose.yml` próprio para o
notification-service + RabbitMQ, na mesma rede Docker da sua API — ambas
as formas funcionam, o que importa é estarem na mesma rede).

```yaml
services:
  rabbitmq:
    image: rabbitmq:3-management
    restart: unless-stopped
    environment:
      RABBITMQ_DEFAULT_USER: ${RABBITMQ_USER}
      RABBITMQ_DEFAULT_PASS: ${RABBITMQ_PASS}
    volumes:
      - rabbitmq_data:/var/lib/rabbitmq
    # SEM "ports:" publicado para o host — só a rede interna do compose
    # precisa alcançar o RabbitMQ. Ver seção 6 sobre exposição pública.
    healthcheck:
      test: ["CMD", "rabbitmq-diagnostics", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  notification-service:
    build:
      context: /srv/notification-service
      dockerfile: Dockerfile
      target: production
    restart: unless-stopped
    depends_on:
      rabbitmq:
        condition: service_healthy
    environment:
      RABBITMQ_URI: amqp://${RABBITMQ_USER}:${RABBITMQ_PASS}@rabbitmq:5672
      EMAIL_PROVIDER: ${EMAIL_PROVIDER:-smtp}
      RESEND_API_KEY: ${RESEND_API_KEY:-}
      SMTP_HOST: ${SMTP_HOST}
      SMTP_PORT: ${SMTP_PORT}
      SMTP_USER: ${SMTP_USER}
      SMTP_PASS: ${SMTP_PASS}
      MAIL_FROM: ${MAIL_FROM}
      MAIL_FROM_NAME: ${MAIL_FROM_NAME}
    volumes:
      # Conteúdo desacoplado da imagem — atualiza via `git pull`, sem rebuild.
      - /srv/notification-service/src/infrastructure/templates:/app/dist/infrastructure/templates:ro
      - /srv/notification-service/src/infrastructure/config/senders.json:/app/dist/infrastructure/config/senders.json:ro

volumes:
  rabbitmq_data:
```

Todas as variáveis (`RABBITMQ_USER`, `SMTP_*`, `RESEND_API_KEY` etc.) ficam
num `.env` local na VPS, fora do controle de versão — use
`.env.example` deste repo como referência dos campos disponíveis.

> [!TIP]
> Se preferir não editar o `docker-compose.yml` da sua API principal
> diretamente, use um `docker-compose.override.yml` (já está no
> `.gitignore` deste repo) só com o bloco acima — o Compose funde os dois
> arquivos automaticamente.

## 6. Passo 3 — Build da imagem

Para começar (serviço ainda não está ativo, sem pressa de CI):

```bash
docker compose build notification-service
docker compose up -d
```

Isso builda direto na VPS a partir do `Dockerfile` deste repo (que precisa
estar corrigido — veja `Dockerfile` na branch `claude/fix-dockerfile-build-deps`
ou já mergeado em `main`: o estágio de build precisa instalar
`devDependencies` para o `nest build` funcionar).

Quando o serviço estiver em produção de verdade e você quiser deploys mais
rápidos/confiáveis, o próximo passo natural é: CI builda e publica a imagem
num registry (GHCR, por exemplo) a cada push em `main`, e a VPS só roda
`docker compose pull && docker compose up -d`. Não é necessário para
começar — é só o passo seguinte quando isso passar a incomodar.

## 7. Passo 4 — Segurança de rede (não pule isso)

- **Nunca publique a porta do RabbitMQ (`5672`) nem o management UI
  (`15672`) direto na internet.** No exemplo da seção 5 já não há `ports:`
  — o serviço só precisa ser alcançável dentro da rede do Compose. Se
  precisar acessar o management UI de fora, use um túnel SSH
  (`ssh -L 15672:localhost:15672 usuario@vps`) ou coloque atrás de VPN,
  nunca exposto diretamente.
- **Troque as credenciais padrão** (`guest`/`guest` não deve existir em
  produção) — defina `RABBITMQ_USER`/`RABBITMQ_PASS` fortes no `.env`.
- **`.env` nunca vai para o Git** (já garantido pelo `.gitignore` deste
  repo) — na VPS, restrinja a permissão do arquivo (`chmod 600 .env`).
- Se usar Resend: os endereços em `senders.json` só funcionam sob um
  **domínio verificado** (SPF/DKIM configurados no painel do Resend) —
  confirme isso antes de apontar `EMAIL_PROVIDER=resend` em produção.

## 8. Adicionando uma nova aplicação cliente — passo a passo

1. Neste repo, crie os templates com prefixo do app, ex.:
   `src/infrastructure/templates/email/appx-welcome-email.hbs`.
2. (Opcional) se o app precisa de remetente próprio, adicione uma entrada em
   `src/infrastructure/config/senders.json`:
   ```json
   { "appx": { "address": "avisos@appx.com", "name": "App X" } }
   ```
3. Abra PR normal, revise, merge em `main` — igual a qualquer mudança de
   código deste repo.
4. Na VPS: `cd /srv/notification-service && git pull`.
5. Templates novos já funcionam na próxima mensagem. Se mexeu no
   `senders.json`, rode `docker compose restart notification-service`.
6. **Nenhum rebuild de imagem é necessário** — só é preciso rebuildar quando
   o *código* do serviço muda (novo provider, dependência, etc.), não
   quando é só conteúdo.

## 9. Integrando a API produtora (a "aplicação à parte")

Qualquer aplicação com acesso à rede do RabbitMQ pode publicar — não
precisa ser NestJS. O ponto que costuma pegar quem vem de outro stack: as
mensagens não são JSON cru na fila, o transporte RMQ do `@nestjs/microservices`
espera um envelope específico:

```json
{
  "pattern": "notifications_queue",
  "data": {
    "recipient": "usuario@appx.com",
    "templateId": "appx-welcome-email",
    "channel": "EMAIL",
    "senderId": "appx",
    "variables": { "firstName": "Maria" }
  }
}
```

`pattern` precisa bater com o nome da fila (`notifications_queue`, ou o
valor de `RABBITMQ_QUEUE` se você customizou) — é isso que faz o
`@EventPattern('notifications_queue')` do `NotificationController`
reconhecer a mensagem. Sem esse envelope, a mensagem chega na fila mas o
serviço não a processa.

**De uma API NestJS:** use `ClientProxy.emit()` — o exemplo completo já está
em [`docs/index.md § 3`](./index.md#3-guia-de-integração-para-sistemas-produtores),
o `ClientProxy` monta esse envelope pra você automaticamente.

**De qualquer outra stack** (Python, Go, Node puro, etc.): publique
diretamente via um cliente AMQP (`pika` em Python, `amqp091-go` em Go,
`amqplib` em Node — o mesmo que `scripts/publish.js` deste repo usa como
referência) montando o envelope acima manualmente antes de serializar como
JSON e publicar na fila `notifications_queue`. Veja `scripts/publish.js`
como exemplo funcional de referência, independente de framework.

`senderId` e `templateId` são os dois campos que fazem o roteamento
multi-app funcionar — combine com o prefixo escolhido no Passo 8.

## 10. Checklist antes de considerar "em produção"

- [ ] `Dockerfile` corrigido (build completo antes do prune de devDeps)
- [ ] RabbitMQ com volume persistente (`rabbitmq_data`) e sem porta pública
- [ ] Credenciais padrão do RabbitMQ trocadas
- [ ] `.env` fora do Git, com permissão restrita na VPS
- [ ] `restart: unless-stopped` (ou `always`) nos serviços
- [ ] Se Resend: domínio verificado e `senders.json` alinhado a ele
- [ ] Diretório `/srv/notification-service` sincronizado via `git pull`,
      independente do ciclo de build da imagem
- [ ] Alguém (ou algum alarme) observando o tamanho da
      `notifications_dead_queue` — acúmulo ali indica falha sistemática
