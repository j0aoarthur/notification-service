#!/usr/bin/env node

/**
 * Script para publicar mensagens na fila de notificações.
 *
 * Uso:
 *   node scripts/publish.js                          # Usa os valores padrão (welcome-email, EMAIL)
 *   node scripts/publish.js --template welcome-sms --channel SMS --recipient +5511999998888
 *   node scripts/publish.js --template welcome-email --channel EMAIL --recipient joao@coop.com --var name="João"
 *
 * Opções:
 *   --template   ID do template (default: welcome-email)
 *   --channel    Canal de entrega: EMAIL ou SMS (default: EMAIL)
 *   --recipient  Destinatário (default: user@cooperativa.com)
 *   --var        Variáveis do template no formato chave=valor (pode repetir)
 *   --uri        URI do RabbitMQ (default: amqp://guest:guest@localhost:5672)
 *   --queue      Nome da fila (default: notifications_queue)
 */

const amqp = require('amqplib');

function parseArgs(argv) {
  const args = {
    template: 'welcome-email',
    channel: 'EMAIL',
    recipient: 'arthur@hotmail.com',
    uri: process.env.RABBITMQ_URI || 'amqp://guest:guest@localhost:5672',
    queue: process.env.RABBITMQ_QUEUE || 'notifications_queue',
    variables: {},
  };

  for (let i = 2; i < argv.length; i++) {
    switch (argv[i]) {
      case '--template':
        args.template = argv[++i];
        break;
      case '--channel':
        args.channel = argv[++i];
        break;
      case '--recipient':
        args.recipient = argv[++i];
        break;
      case '--uri':
        args.uri = argv[++i];
        break;
      case '--queue':
        args.queue = argv[++i];
        break;
      case '--var': {
        const [key, ...rest] = argv[++i].split('=');
        args.variables[key] = rest.join('=');
        break;
      }
      case '--help':
        console.log(`
Uso: node scripts/publish.js [opções]

Opções:
  --template   ID do template (default: welcome-email)
  --channel    Canal: EMAIL ou SMS (default: EMAIL)
  --recipient  Destinatário (default: user@cooperativa.com)
  --var        Variável chave=valor (pode repetir)
  --uri        URI do RabbitMQ (default: amqp://guest:guest@localhost:5672)
  --queue      Nome da fila (default: notifications_queue)

Exemplos:
  node scripts/publish.js
  node scripts/publish.js --template welcome-email --var name="João Cooperado"
  node scripts/publish.js --template welcome-sms --channel SMS --recipient +5511999998888 --var name="Maria"
        `);
        process.exit(0);
    }
  }

  // Se nenhuma variável foi passada, usa um default amigável
  if (Object.keys(args.variables).length === 0) {
    args.variables = { firstName: 'Cooperado Teste' };
  }

  return args;
}

async function main() {
  const args = parseArgs(process.argv);

  console.log('📨 Publicando notificação...');
  console.log(`   Template:    ${args.template}`);
  console.log(`   Canal:       ${args.channel}`);
  console.log(`   Destinatário: ${args.recipient}`);
  console.log(`   Variáveis:   ${JSON.stringify(args.variables)}`);
  console.log(`   Fila:        ${args.queue}`);
  console.log('');

  const conn = await amqp.connect(args.uri);
  const ch = await conn.createChannel();

  const message = JSON.stringify({
    pattern: args.queue,
    data: {
      templateId: args.template,
      channel: args.channel,
      recipient: args.recipient,
      variables: args.variables,
    },
  });

  ch.sendToQueue(args.queue, Buffer.from(message), {
    contentType: 'application/json',
  });

  console.log('✅ Mensagem publicada com sucesso!');
  console.log('');
  console.log('Próximos passos:');
  console.log('  → Logs do serviço: verifique o terminal rodando npm run start:dev');

  if (args.channel === 'EMAIL') {
    console.log('  → MailHog: http://localhost:8025');
  }

  console.log('  → RabbitMQ: http://localhost:15672');

  await ch.close();
  await conn.close();
}

main().catch((err) => {
  console.error('❌ Erro ao publicar:', err.message);
  process.exit(1);
});
