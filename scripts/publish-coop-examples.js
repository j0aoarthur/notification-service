#!/usr/bin/env node

/**
 * Script para publicar exemplos de todos os templates do Sistema de Cooperativas na fila RabbitMQ.
 *
 * Inclui:
 *   --- Templates Existentes ---
 *   1.  coop-welcome-email          (Boas-vindas ao cooperado)
 *   2.  coop-shift-enrollment       (Confirmação de inscrição no turno)
 *   3.  coop-shift-reminder-12h     (Lembrete de turno 12h antes)
 *   4.  coop-check-in-confirmed     (Confirmação de check-in)
 *   5.  coop-check-out-confirmed    (Confirmação de check-out / turno concluído)
 *
 *   --- Novos Templates (Algoritmo de Escalonamento) ---
 *   6.  coop-shift-new-slots        (Novas vagas abertas — broadcast)
 *   7.  coop-shift-roster           (Roteiro de tarefas pós-consolidação)
 *   8.  coop-sos-skill-gap          (Alerta SOS: escassez de skill crítica)
 *   9.  coop-task-reassignment      (Mudança de tarefa por realocação em cascata)
 *   10. coop-no-show-urgent-bonus   (Urgência por no-show com bônus)
 *   11. coop-purchase-unlocked      (Carga horária mínima atingida — compras liberadas)
 *   12. coop-member-suspended       (Membro suspenso por penalidades)
 *
 * Uso:
 *   node scripts/publish-coop-examples.js
 *
 * Variáveis de ambiente:
 *   RECIPIENT_EMAIL   — destinatário de teste (padrão: joao@cooperativa.com)
 *   RABBITMQ_URI      — URI do RabbitMQ      (padrão: amqp://guest:guest@localhost:5672)
 *   RABBITMQ_QUEUE    — nome da fila         (padrão: notifications_queue)
 *   TEMPLATE_FILTER   — índice(s) a enviar, separados por vírgula (ex: "1,3,6"). Omitir = enviar todos.
 */

const amqp = require('amqplib');

const defaultRecipient = process.env.RECIPIENT_EMAIL || 'joao@cooperativa.com';
const memberName = 'João Arthur';
const firstName = 'João';

const examples = [
  // ─────────────────────────────────────────────────────────────────────────
  // TEMPLATES EXISTENTES
  // ─────────────────────────────────────────────────────────────────────────
  {
    name: '1. Welcome Email (Boas-vindas ao Cooperado)',
    payload: {
      recipient: defaultRecipient,
      templateId: 'coop-welcome-email',
      channel: 'EMAIL',
      senderId: 'coop',
      variables: {
        firstName,
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
        memberName,
        shiftTitle: 'Triagem e Recepção de Produtos',
        shiftDate: '24/10/2026',
        startTime: '08:00',
        endTime: '12:00',
      },
    },
  },
  {
    name: '3. Shift Reminder 12h (Lembrete de Turno — 12 Horas Antes)',
    payload: {
      recipient: defaultRecipient,
      templateId: 'coop-shift-reminder-12h',
      channel: 'EMAIL',
      senderId: 'coop',
      variables: {
        memberName,
        shiftTitle: 'Triagem e Recepção de Produtos',
        shiftDate: '24/10/2026',
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
        memberName,
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
        memberName,
        shiftDate: '24/10/2026',
        checkOutTime: '12:05',
        workedHours: '4h05min',
      },
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // NOVOS TEMPLATES — ALGORITMO DE ESCALONAMENTO
  // ─────────────────────────────────────────────────────────────────────────
  {
    name: '6. Shift New Slots (Novas Vagas Abertas — Broadcast)',
    payload: {
      recipient: defaultRecipient,
      templateId: 'coop-shift-new-slots',
      channel: 'EMAIL',
      senderId: 'coop',
      variables: {
        // Sem memberName — é broadcast para todos os cooperados
        shiftTitle: 'Turno da Manhã — Recebimento',
        shiftDate: '25/10/2026',
        startTime: '08:00',
        endTime: '12:00',
        newSlots: '2',
        taskTitle: 'Descarregar Caminhão de Grãos',
      },
    },
  },
  {
    name: '7. Shift Roster (Roteiro de Tarefas Pós-Consolidação)',
    payload: {
      recipient: defaultRecipient,
      templateId: 'coop-shift-roster',
      channel: 'EMAIL',
      senderId: 'coop',
      variables: {
        memberName,
        shiftTitle: 'Turno da Manhã — Recebimento',
        shiftDate: '25/10/2026',
        startTime: '08:00',
        endTime: '12:00',
        taskTitle: 'Frente de Caixa',
        taskDescription: 'Operar o caixa do setor de frios e bebidas',
      },
    },
  },
  {
    name: '7b. Shift Roster — sem descrição de tarefa (campo opcional vazio)',
    payload: {
      recipient: defaultRecipient,
      templateId: 'coop-shift-roster',
      channel: 'EMAIL',
      senderId: 'coop',
      variables: {
        memberName,
        shiftTitle: 'Turno da Tarde — Reposição',
        shiftDate: '25/10/2026',
        startTime: '13:00',
        endTime: '17:00',
        taskTitle: 'Reposição de Prateleiras',
        taskDescription: '', // campo vazio — template deve omitir via {{#if}}
      },
    },
  },
  {
    name: '8. SOS Skill Gap (Alerta SOS — Escassez de Skill Crítica)',
    payload: {
      recipient: defaultRecipient,
      templateId: 'coop-sos-skill-gap',
      channel: 'EMAIL',
      senderId: 'coop',
      variables: {
        memberName,
        shiftTitle: 'Turno da Manhã — Recebimento',
        shiftDate: '25/10/2026',
        startTime: '08:00',
        endTime: '12:00',
        taskTitle: 'Frente de Caixa',
        skillName: 'Operador de Caixa',
        bonusInfo: 'Ganhe horas extras como bônus pela sua disponibilidade!',
      },
    },
  },
  {
    name: '9. Task Reassignment (Mudança de Tarefa por Realocação em Cascata)',
    payload: {
      recipient: defaultRecipient,
      templateId: 'coop-task-reassignment',
      channel: 'EMAIL',
      senderId: 'coop',
      variables: {
        memberName,
        previousTaskTitle: 'Limpeza e Organização Geral',
        newTaskTitle: 'Frente de Caixa',
        shiftDate: '25/10/2026',
        startTime: '08:00',
        endTime: '12:00',
      },
    },
  },
  {
    name: '10. No-Show Urgent Bonus (Urgência por No-Show com Bônus)',
    payload: {
      recipient: defaultRecipient,
      templateId: 'coop-no-show-urgent-bonus',
      channel: 'EMAIL',
      senderId: 'coop',
      variables: {
        memberName,
        shiftDate: '25/10/2026',
        startTime: '08:00',
        endTime: '12:00',
        taskTitle: 'Frente de Caixa',
        skillName: 'Operador de Caixa',
        bonusHours: '2h extras',
      },
    },
  },
  {
    name: '11. Purchase Unlocked (Carga Horária Mínima Atingida — Compras Liberadas)',
    payload: {
      recipient: defaultRecipient,
      templateId: 'coop-purchase-unlocked',
      channel: 'EMAIL',
      senderId: 'coop',
      variables: {
        memberName,
        totalHours: '42.5h',
        minimumRequired: '40h',
        referenceMonth: 'Outubro de 2026',
      },
    },
  },
  {
    name: '12. Member Suspended (Membro Suspenso por Penalidades)',
    payload: {
      recipient: defaultRecipient,
      templateId: 'coop-member-suspended',
      channel: 'EMAIL',
      senderId: 'coop',
      variables: {
        memberName,
        penaltyCount: '2',
        reason: 'No-show',
        suspensionDate: '20/10/2026',
      },
    },
  },
  {
    name: '12b. Member Suspended — por cancelamento tardio',
    payload: {
      recipient: defaultRecipient,
      templateId: 'coop-member-suspended',
      channel: 'EMAIL',
      senderId: 'coop',
      variables: {
        memberName,
        penaltyCount: '2',
        reason: 'Cancelamento tardio',
        suspensionDate: '20/10/2026',
      },
    },
  },
];

async function main() {
  const uri = process.env.RABBITMQ_URI || 'amqp://guest:guest@localhost:5672';
  const queue = process.env.RABBITMQ_QUEUE || 'notifications_queue';

  // Suporte a filtro por índice (1-based). Ex: TEMPLATE_FILTER=1,6,11
  const filterEnv = process.env.TEMPLATE_FILTER;
  const selectedExamples = filterEnv
    ? (() => {
        const indices = filterEnv.split(',').map((n) => parseInt(n.trim(), 10) - 1);
        return indices
          .map((i) => examples[i])
          .filter(Boolean);
      })()
    : examples;

  if (selectedExamples.length === 0) {
    console.error('❌ Nenhum template encontrado com o filtro especificado.');
    console.error(`   TEMPLATE_FILTER="${filterEnv}" — verifique os índices (1 a ${examples.length}).`);
    process.exit(1);
  }

  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║     Sistema de Cooperativas — Publisher de Templates         ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`🔌 Conectando ao RabbitMQ em: ${uri}...`);

  const conn = await amqp.connect(uri);
  const ch = await conn.createChannel();

  const total = selectedExamples.length;
  const allCount = examples.length;
  const label = filterEnv ? `${total} de ${allCount}` : `${total}`;

  console.log(`🚀 Publicando ${label} mensagem(ns) na fila "${queue}"...\n`);

  let published = 0;
  for (const example of selectedExamples) {
    const message = JSON.stringify({
      pattern: queue,
      data: example.payload,
    });

    ch.sendToQueue(queue, Buffer.from(message), {
      contentType: 'application/json',
    });

    published++;
    console.log(`  ✅ [${published}/${total}] ${example.name}`);
    console.log(`     Template:     ${example.payload.templateId}`);
    console.log(`     Destinatário: ${example.payload.recipient}`);
    console.log('');
  }

  await ch.close();
  await conn.close();

  console.log('─'.repeat(64));
  console.log(`🎉 ${published} notificação(ões) publicada(s) com sucesso!`);
  console.log('');
  console.log('📬 Verifique os e-mails renderizados no MailHog:');
  console.log('   👉 http://localhost:8025');
  console.log('');
  console.log('💡 Dica: para enviar apenas templates específicos, use:');
  console.log('   TEMPLATE_FILTER=6,7,8 node scripts/publish-coop-examples.js');
  console.log('');
}

main().catch((err) => {
  console.error('❌ Erro ao publicar mensagens:', err.message);
  process.exit(1);
});
