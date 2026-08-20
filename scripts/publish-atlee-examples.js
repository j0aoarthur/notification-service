#!/usr/bin/env node

/**
 * Script para publicar exemplos de todos os templates da Atlee na fila RabbitMQ.
 *
 * Inclui:
 *   1. atlee-ticket-purchase-confirmed (1 ingresso / single ticket com QR code inline)
 *   2. atlee-ticket-purchase-confirmed (múltiplos ingressos / multi ticket sem QR inline)
 *   3. atlee-store-purchase-confirmed (compra na loja)
 *   4. atlee-order-ready-for-pickup (pedido pronto para retirada)
 *   5. atlee-student-welcome (boas-vindas ao portal)
 *
 * Uso:
 *   node scripts/publish-atlee-examples.js
 */

const amqp = require('amqplib');

const tenantBranding = {
  tenantName: 'Atlética Psicoferas',
  primaryColor: '#EAB308',
  secondaryColor: '#22D3EE',
  accentColor: '#7C3AED',
  instagramUrl: 'https://instagram.com/psicoferas',
  whatsappNumber: '5511987654321',
  tenantLogoUrl:
    'https://pub-0def81001bcf4adbb472d8a4b0c686a7.r2.dev/019fe539-4ce1-763a-8b76-b80d54a82000/branding/87e517fe-c350-472b-83de-805c255dd2ad.webp',
  recipientEmail: 'joao@uni.edu.br',
  studentName: 'João Arthur',
};

const examples = [
  {
    name: '1. Ticket Purchase Confirmed (1 Ingresso / Single Ticket)',
    payload: {
      recipient: 'joao@uni.edu.br',
      templateId: 'atlee-ticket-purchase-confirmed',
      channel: 'EMAIL',
      senderId: 'atlee',
      variables: {
        ...tenantBranding,
        eventName: 'Festa Junina Psicoferas 2026',
        eventDate: '28 de junho de 2026, às 22h',
        eventLocation: 'Espaço Sunset — Av. dos Universitários, 1000',
        orderNumber: 5011,
        totalValue: 'R$ 60,00',
        billingType: 'Pix',
        isCourtesy: false,
        walletUrl: 'https://psicoferas.atlee.com.br/ingressos',
        tickets: [
          {
            ticketNumber: 1,
            ticketTypeName: '1° Lote Promocional',
            qrCodeHash:
              '3fa85f64-5717-4562-b3fc-2c963f66afa6:a1b2c3d4e5f60718293a4b5c6d7e8f90',
            ticketUrl:
              'https://psicoferas.atlee.com.br/ingressos/ticket-5011-1',
          },
        ],
      },
    },
  },
  {
    name: '2. Ticket Purchase Confirmed (Múltiplos Ingressos / 2 Ingressos)',
    payload: {
      recipient: 'joao@uni.edu.br',
      templateId: 'atlee-ticket-purchase-confirmed',
      channel: 'EMAIL',
      senderId: 'atlee',
      variables: {
        ...tenantBranding,
        eventName: 'InterAtléticas 2026 — Edição Psicologia',
        eventDate: '15 de outubro de 2026, às 14h',
        eventLocation: 'Arena Poliesportiva Central — Ginásio A',
        orderNumber: 5012,
        totalValue: 'R$ 140,00',
        billingType: 'Cartão de Crédito',
        isCourtesy: false,
        walletUrl: 'https://psicoferas.atlee.com.br/ingressos',
        tickets: [
          {
            ticketNumber: 1,
            ticketTypeName: '1° Lote - Pista',
            qrCodeHash:
              '3fa85f64-5717-4562-b3fc-2c963f66afa6:a1b2c3d4e5f60718293a4b5c6d7e8f90',
            ticketUrl:
              'https://psicoferas.atlee.com.br/ingressos/ticket-5012-1',
          },
          {
            ticketNumber: 2,
            ticketTypeName: '1° Lote - Pista',
            qrCodeHash:
              '7ca92f14-8812-4912-a1dc-9a873f11bcb2:f0e1d2c3b4a5968778695a4b3c2d1e0f',
            ticketUrl:
              'https://psicoferas.atlee.com.br/ingressos/ticket-5012-2',
          },
        ],
      },
    },
  },
  {
    name: '3. Store Purchase Confirmed (Compra na Loja)',
    payload: {
      recipient: 'joao@uni.edu.br',
      templateId: 'atlee-store-purchase-confirmed',
      channel: 'EMAIL',
      senderId: 'atlee',
      variables: {
        ...tenantBranding,
        orderNumber: 5013,
        totalValue: 'R$ 169,70',
        billingType: 'Pix',
        items: [
          {
            productName: 'Camiseta Oficial Psicoferas 2026',
            variantLabel: 'G',
            quantity: 2,
            unitPrice: 'R$ 59,90',
          },
          {
            productName: 'Tirante + Caneca 850ml',
            variantLabel: 'Amarelo/Ciano',
            quantity: 1,
            unitPrice: 'R$ 49,90',
          },
        ],
        pickupAddress: 'Bloco H, Sala 202 — Campus Principal',
        pickupHours: 'Seg a Sex, 12h às 18h',
        orderUrl: 'https://psicoferas.atlee.com.br/pedidos/5013',
      },
    },
  },
  {
    name: '4. Order Ready for Pickup (Pronto para Retirada)',
    payload: {
      recipient: 'joao@uni.edu.br',
      templateId: 'atlee-order-ready-for-pickup',
      channel: 'EMAIL',
      senderId: 'atlee',
      variables: {
        ...tenantBranding,
        orderNumber: 5013,
        productNames: [
          'Camiseta Oficial Psicoferas 2026 (G)',
          'Tirante + Caneca 850ml',
        ],
        pickupAddress: 'Bloco H, Sala 202 — Campus Principal',
        pickupHours: 'Seg a Sex, 12h às 18h',
        qrCodeHash: 'pickup-5013-87e517fe-c350-472b-83de-805c255dd2ad',
        orderUrl: 'https://psicoferas.atlee.com.br/pedidos/5013',
      },
    },
  },
  {
    name: '5. Student Welcome (Boas-vindas ao Portal)',
    payload: {
      recipient: 'joao@uni.edu.br',
      templateId: 'atlee-student-welcome',
      channel: 'EMAIL',
      senderId: 'atlee',
      variables: {
        ...tenantBranding,
        portalUrl: 'https://psicoferas.atlee.com.br',
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
    console.log(`     Remetente:    ${example.payload.senderId}`);
    console.log('');
  }

  await ch.close();
  await conn.close();

  console.log('🎉 Todas as notificações de teste foram enviadas para a fila com sucesso!');
  console.log('');
  console.log('📬 Verifique os e-mails renderizados no MailHog:');
  console.log('   👉 http://localhost:8025');
  console.log('');
}

main().catch((err) => {
  console.error('❌ Erro ao publicar mensagens:', err.message);
  process.exit(1);
});
