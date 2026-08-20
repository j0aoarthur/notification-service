#!/usr/bin/env node

/**
 * Script para publicar exemplos de todos os templates do Sistema de Cooperativas na fila RabbitMQ.
 *
 * Inclui:
 *   1. coop-welcome-email (Boas-vindas ao cooperado)
 *   2. coop-shift-enrollment (Confirmação de inscrição no turno)
 *   3. coop-shift-reminder-12h (Lembrete de turno 12h antes)
 *   4. coop-check-in-confirmed (Confirmação de check-in)
 *   5. coop-check-out-confirmed (Confirmação de check-out / turno concluído)
 *
 * Uso:
 *   node scripts/publish-coop-examples.js
 */

const amqp = require('amqplib');

const defaultRecipient = process.env.RECIPIENT_EMAIL || 'joao@cooperativa.com';
const memberName = 'João Arthur';
const firstName = 'João';

const examples = [
  {
    name: '1. Welcome Email (Boas-vindas ao Cooperado)',
    payload: {
      recipient: defaultRecipient,
      templateId: 'coop-welcome-email',
      channel: 'EMAIL',
      senderId: 'coop',
      variables: {
        firstName: firstName,
      },
    },
  },
  {
    name: '2. Shift Enrollment (Confirmação de Inscrição no Turno)',
    payload: {
      recipient: defaultRecipient,
      templateId: 'coop-shift-enrollment',
      channel: 'EMAIL',
      senderId: 'coop',
      variables: {
        memberName: memberName,
        shiftTitle: 'Triagem e Recepção de Produtos',
        shiftDate: '24 de Outubro de 2026',
        startTime: '08:00',
        endTime: '12:00',
      },
    },
  },
  {
    name: '3. Shift Reminder 12h (Lembrete de Turno - 12 Horas Antes)',
    payload: {
      recipient: defaultRecipient,
      templateId: 'coop-shift-reminder-12h',
      channel: 'EMAIL',
      senderId: 'coop',
      variables: {
        memberName: memberName,
        shiftTitle: 'Triagem e Recepção de Produtos',
        shiftDate: '24 de Outubro de 2026',
        startTime: '08:00',
        endTime: '12:00',
      },
    },
  },
  {
    name: '4. Check-in Confirmed (Confirmação de Check-in no Turno)',
    payload: {
      recipient: defaultRecipient,
      templateId: 'coop-check-in-confirmed',
      channel: 'EMAIL',
      senderId: 'coop',
      variables: {
        memberName: memberName,
        shiftDate: '24/10/2026',
        checkInTime: '07:55',
        shiftEndTime: '12:00',
      },
    },
  },
  {
    name: '5. Check-out Confirmed (Confirmação de Check-out e Turno Concluído)',
    payload: {
      recipient: defaultRecipient,
      templateId: 'coop-check-out-confirmed',
      channel: 'EMAIL',
      senderId: 'coop',
      variables: {
        memberName: memberName,
        shiftDate: '24/10/2026',
        checkOutTime: '12:05',
        workedHours: '4 horas e 10 minutos',
      },
    },
  },
];

async function main() {
  const uri = process.env.RABBITMQ_URI || 'amqp://guest:guest@localhost:5672';
  const queue = process.env.RABBITMQ_QUEUE || 'notifications_queue';

  console.log(`🔌 Conectando ao RabbitMQ em: ${uri}...`);
  const conn = await amqp.connect(uri);
  const ch = await conn.createChannel();

  console.log(`🚀 Publicando ${examples.length} mensagens na fila "${queue}"...\n`);

  for (const example of examples) {
    const message = JSON.stringify({
      pattern: queue,
      data: example.payload,
    });

    ch.sendToQueue(queue, Buffer.from(message), {
      contentType: 'application/json',
    });

    console.log(`  ✅ [PUBLICADO] ${example.name}`);
    console.log(`     Template:     ${example.payload.templateId}`);
    console.log(`     Destinatário: ${example.payload.recipient}`);
    console.log('');
  }

  await ch.close();
  await conn.close();

  console.log('🎉 Todas as notificações de cooperativa foram enviadas para a fila com sucesso!');
  console.log('');
  console.log('📬 Verifique os e-mails renderizados no MailHog:');
  console.log('   👉 http://localhost:8025');
  console.log('');
}

main().catch((err) => {
  console.error('❌ Erro ao publicar mensagens:', err.message);
  process.exit(1);
});
