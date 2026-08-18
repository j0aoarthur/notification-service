# Guia de Templates — Notification Service

> **Motor de templates:** [Handlebars.js](https://handlebarsjs.com/) + [gray-matter](https://github.com/jonschlinkert/gray-matter)  
> **Implementação:** [`handlebars-template-engine.service.ts`](file:///Users/joaoarthur/Downloads/Estudos/notification-service/src/infrastructure/template-engine/handlebars-template-engine.service.ts)

---

## Sumário

1. [Visão Geral](#1-visão-geral)
2. [Estrutura de Arquivos](#2-estrutura-de-arquivos)
3. [Anatomia de um Template `.hbs`](#3-anatomia-de-um-template-hbs)
4. [Sintaxe Handlebars — Referência Rápida](#4-sintaxe-handlebars--referência-rápida)
5. [Listas com Número Variável de Itens](#5-listas-com-número-variável-de-itens)
6. [Condicionais e Lógica](#6-condicionais-e-lógica)
7. [Como Passar as Variáveis (Payload)](#7-como-passar-as-variáveis-payload)
8. [Exemplos Completos](#8-exemplos-completos)
9. [Regras e Restrições](#9-regras-e-restrições)

---

## 1. Visão Geral

O serviço usa o Handlebars como motor de renderização de templates. O fluxo é:

```
Payload (JSON via RabbitMQ)
        │
        ▼
  ProcessNotificationUseCase
        │
        ▼
  HandlebarsTemplateEngine.compile(templateId, channel, variables, recipient)
        │  ├─ Lê o arquivo: src/infrastructure/templates/{channel}/{templateId}.hbs
        │  ├─ Extrai o front-matter YAML (gray-matter) → subject, etc.
        │  └─ Compila o body com Handlebars interpolando as `variables`
        ▼
  CompiledMessage { recipient, channel, subject, body }
        │
        ▼
  DeliveryProvider (Resend / Twilio / etc.)
```

---

## 2. Estrutura de Arquivos

```
src/infrastructure/templates/
├── email/
│   ├── welcome-email.hbs         ← template de e-mail
│   └── order-confirmation.hbs    ← (exemplo)
└── sms/
    ├── welcome-sms.hbs           ← template de SMS
    └── order-shipped.hbs         ← (exemplo)
```

### Convenções de nomenclatura

| Regra | Exemplo correto | Exemplo inválido |
|---|---|---|
| Apenas letras minúsculas, números e hífens | `order-confirmation` | `Order_Confirmation` |
| Canal em letras minúsculas como pasta | `email/`, `sms/` | `EMAIL/`, `SMS/` |
| Extensão obrigatória `.hbs` | `welcome-email.hbs` | `welcome-email.html` |

O `templateId` enviado no payload deve corresponder **exatamente** ao nome do arquivo (sem a extensão `.hbs`).

---

## 3. Anatomia de um Template `.hbs`

Todo arquivo `.hbs` é dividido em duas seções separadas pelo delimitador `---`:

```
---
[FRONT-MATTER YAML]       ← metadados fixos (ex.: assunto do e-mail)
---
[CORPO DO TEMPLATE]       ← HTML ou texto puro com expressões Handlebars
```

### Seção 1 — Front-matter (YAML)

O front-matter é extraído pelo **gray-matter**. As variáveis definidas aqui também **suportam interpolação Handlebars** — ou seja, você pode usar `{{variavel}}` dentro do `subject`.

```yaml
---
subject: "Confirmação do pedido #{{orderId}} — {{customerName}}"
---
```

> **Atenção:** Atualmente, apenas o campo `subject` é lido e compilado pelo serviço. Outros campos no front-matter são ignorados pelo código de compilação.

### Seção 2 — Corpo (body)

O corpo pode ser **HTML** (para e-mail) ou **texto puro** (para SMS). Qualquer expressão Handlebars válida é permitida aqui.

---

## 4. Sintaxe Handlebars — Referência Rápida

### Interpolação de variável simples

```handlebars
{{nomeDaVariavel}}
```

O Handlebars escapa automaticamente caracteres HTML (`<`, `>`, `&`). Para renderizar HTML bruto (não recomendado com dados externos), use `{{{variavel}}}`.

### Acesso a propriedades aninhadas (objetos)

Se a variável `customer` for um objeto `{ name: "Ana", city: "SP" }`:

```handlebars
{{customer.name}}
{{customer.city}}
```

### Comentários (não aparecem no output)

```handlebars
{{!-- Este comentário não aparece no output final --}}
```

---

## 5. Listas com Número Variável de Itens

Esta é a funcionalidade mais importante para o seu caso de uso. O helper `{{#each}}` do Handlebars itera sobre um array com qualquer número de itens.

### Como funciona

No payload de variáveis, você passa um array:

```json
{
  "variables": {
    "customerName": "João",
    "products": [
      { "name": "Camiseta", "qty": 2, "price": "R$ 59,90" },
      { "name": "Calça",    "qty": 1, "price": "R$ 129,90" },
      { "name": "Tênis",    "qty": 1, "price": "R$ 299,90" }
    ]
  }
}
```

No template, você itera com `{{#each}}`:

```handlebars
{{#each products}}
  <tr>
    <td>{{this.name}}</td>
    <td>{{this.qty}}</td>
    <td>{{this.price}}</td>
  </tr>
{{/each}}
```

O bloco entre `{{#each}}` e `{{/each}}` se repete **uma vez por item** da lista, independentemente do tamanho do array.

### Variáveis especiais dentro do `#each`

| Expressão | Descrição |
|---|---|
| `{{this}}` | O item atual (se o array for de strings/números simples) |
| `{{this.campo}}` | Acessa um campo do objeto atual |
| `{{@index}}` | Índice numérico do item atual (começa em `0`) |
| `{{@first}}` | `true` se for o primeiro item |
| `{{@last}}` | `true` se for o último item |

### Exemplo com índice e formatação condicional

```handlebars
{{#each products}}
  <tr {{#if @last}}style="font-weight:bold"{{/if}}>
    <td>{{@index}}.</td>
    <td>{{this.name}}</td>
    <td>{{this.price}}</td>
  </tr>
{{/each}}
```

### Array de strings simples

Se o array contiver apenas strings (ex.: `["Produto A", "Produto B"]`), use `{{this}}`:

```handlebars
<ul>
  {{#each productNames}}
    <li>{{this}}</li>
  {{/each}}
</ul>
```

---

## 6. Condicionais e Lógica

### `{{#if}} / {{else}}`

```handlebars
{{#if discount}}
  <p>🎉 Você ganhou {{discount}}% de desconto!</p>
{{else}}
  <p>Confira nossas promoções na loja.</p>
{{/if}}
```

> `{{#if}}` considera `false`, `null`, `undefined`, `0`, `""` e arrays vazios como **falsy**.

### `{{#unless}}` (inverso do `if`)

```handlebars
{{#unless isPaid}}
  <p style="color:red">⚠️ Pagamento pendente.</p>
{{/unless}}
```

### Combinando `#each` com `#if`

```handlebars
{{#if products}}
  <table>
    {{#each products}}
      <tr>
        <td>{{this.name}}</td>
        <td>{{this.price}}</td>
      </tr>
    {{/each}}
  </table>
{{else}}
  <p>Nenhum produto encontrado.</p>
{{/if}}
```

---

## 7. Como Passar as Variáveis (Payload)

O campo `variables` no payload é um objeto JSON genérico (`Record<string, unknown>`). Você pode estruturá-lo livremente — objetos aninhados, arrays, strings, números e booleanos são todos suportados.

### Payload completo (exemplo via RabbitMQ ou HTTP)

```json
{
  "recipient": "joao@exemplo.com",
  "templateId": "order-confirmation",
  "channel": "EMAIL",
  "variables": {
    "customerName": "João Arthur",
    "orderId": "ORD-2026-001",
    "orderDate": "18/08/2026",
    "isPaid": true,
    "discount": null,
    "products": [
      { "name": "Camiseta Branca", "qty": 2, "unitPrice": "R$ 59,90", "total": "R$ 119,80" },
      { "name": "Boné Preto",      "qty": 1, "unitPrice": "R$ 49,90", "total": "R$ 49,90"  }
    ],
    "orderTotal": "R$ 169,70"
  }
}
```

> ⚠️ **PII:** O campo `variables` pode conter dados pessoais. O serviço nunca loga seu conteúdo.

---

## 8. Exemplos Completos

### E-mail de confirmação de pedido com lista de produtos variável

**Arquivo:** `src/infrastructure/templates/email/order-confirmation.hbs`

```handlebars
---
subject: "Pedido #{{orderId}} confirmado — {{customerName}}"
---
<html>
  <body style="font-family: sans-serif; color: #333;">
    <h1>Olá, {{customerName}}!</h1>
    <p>Seu pedido <strong>#{{orderId}}</strong> foi confirmado em {{orderDate}}.</p>

    <h2>Itens do pedido</h2>
    {{#if products}}
      <table border="1" cellpadding="8" cellspacing="0" width="100%">
        <thead>
          <tr>
            <th>#</th>
            <th>Produto</th>
            <th>Qtd.</th>
            <th>Preço Unit.</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {{#each products}}
            <tr>
              <td>{{@index}}</td>
              <td>{{this.name}}</td>
              <td>{{this.qty}}</td>
              <td>{{this.unitPrice}}</td>
              <td>{{this.total}}</td>
            </tr>
          {{/each}}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="4"><strong>Total do Pedido</strong></td>
            <td><strong>{{orderTotal}}</strong></td>
          </tr>
        </tfoot>
      </table>
    {{else}}
      <p>Nenhum produto encontrado no pedido.</p>
    {{/if}}

    {{#if isPaid}}
      <p style="color: green;">✅ Pagamento confirmado.</p>
    {{else}}
      <p style="color: red;">⚠️ Aguardando confirmação de pagamento.</p>
    {{/if}}

    <p>Obrigado pela sua compra!</p>
  </body>
</html>
```

---

### SMS de rastreamento de pedido

**Arquivo:** `src/infrastructure/templates/sms/order-shipped.hbs`

```handlebars
---
subject: "Pedido Enviado"
---
Olá {{customerName}}, seu pedido #{{orderId}} foi enviado! Rastreie em: {{trackingUrl}}
```

**Payload:**

```json
{
  "recipient": "+5511999999999",
  "templateId": "order-shipped",
  "channel": "SMS",
  "variables": {
    "customerName": "João",
    "orderId": "ORD-2026-001",
    "trackingUrl": "https://rastreio.exemplo.com/ORD-2026-001"
  }
}
```

---

## 9. Regras e Restrições

| # | Regra |
|---|---|
| 1 | O `templateId` deve conter apenas letras minúsculas, números e hífens (`^[a-z0-9-]+$`). |
| 2 | O arquivo `.hbs` deve estar na pasta correta: `email/` para `channel: "EMAIL"` e `sms/` para `channel: "SMS"`. |
| 3 | Se o arquivo `.hbs` não for encontrado, o serviço lança `TemplateNotFoundException` e a mensagem vai para a DLQ. |
| 4 | O front-matter **deve** usar delimitadores `---`. Qualquer campo YAML além de `subject` é ignorado. |
| 5 | O `subject` no front-matter também é compilado via Handlebars — você pode usar `{{variavel}}` nele. |
| 6 | Arrays vazios em `{{#each}}` simplesmente não renderizam nada (o bloco é ignorado). Use `{{#if}}` antes para mostrar uma mensagem alternativa. |
| 7 | O Handlebars **escapa HTML** por padrão. Use `{{{variavel}}}` (três chaves) apenas se o valor já for HTML confiável. |
| 8 | Não existem helpers customizados registrados além dos nativos do Handlebars (`#each`, `#if`, `#unless`, `#with`). |
