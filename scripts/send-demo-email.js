#!/usr/bin/env node

/**
 * Script de demonstração — envia um e-mail bonito diretamente via SMTP para o MailHog.
 *
 * Uso:
 *   node scripts/send-demo-email.js
 *   node scripts/send-demo-email.js --name "João Cooperado" --to "joao@coop.com"
 *
 * Pré-requisito: MailHog rodando em localhost:1025
 *   docker compose up mailhog -d
 *
 * Depois abra: http://localhost:8025
 */

const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

// ── Config ─────────────────────────────────────────────────────────────────
const SMTP_HOST = process.env.SMTP_HOST || 'localhost';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '1025', 10);
const SMTP_FROM = process.env.SMTP_FROM || 'noreply@notification-service.local';
const SMTP_FROM_NAME = process.env.SMTP_FROM_NAME || 'Sistema de Cooperativas';

function parseArgs(argv) {
  const args = {
    name: 'João Cooperado',
    to: 'demo@cooperativa.com',
  };

  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--name') args.name = argv[++i];
    else if (argv[i] === '--to') args.to = argv[++i];
    else if (argv[i] === '--help') {
      console.log(`
Uso: node scripts/send-demo-email.js [opções]

Opções:
  --name  Nome do destinatário (default: "João Cooperado")
  --to    E-mail do destinatário (default: demo@cooperativa.com)

Exemplo:
  node scripts/send-demo-email.js --name "Maria Silva" --to "maria@coop.com"
      `);
      process.exit(0);
    }
  }

  return args;
}

// ── Handlebars-lite: substitui {{variável}} no template ──────────────────────
function renderTemplate(templatePath, variables) {
  let content = fs.readFileSync(templatePath, 'utf-8');

  // Extrai o subject do frontmatter YAML (---\nsubject: "..."\n---)
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n/);
  let subject = 'Bem-vindo(a) ao Sistema de Cooperativas';

  if (frontmatterMatch) {
    const subjectMatch = frontmatterMatch[1].match(/subject:\s*"?([^"\n]+)"?/);
    if (subjectMatch) subject = subjectMatch[1].trim();
    content = content.slice(frontmatterMatch[0].length);
  }

  // Interpola variáveis
  const rendered = content.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] ?? '');
  const renderedSubject = subject.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] ?? '');

  return { html: rendered, subject: renderedSubject };
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const args = parseArgs(process.argv);

  const templatePath = path.resolve(
    __dirname,
    '../src/infrastructure/templates/email/welcome-email.hbs',
  );

  if (!fs.existsSync(templatePath)) {
    console.error('❌ Template não encontrado:', templatePath);
    process.exit(1);
  }

  const { html, subject } = renderTemplate(templatePath, {
    firstName: args.name,
  });

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: false,
    ignoreTLS: true,
  });

  console.log('');
  console.log('╔═══════════════════════════════════════════╗');
  console.log('║   📧  Notification Service — Demo Email   ║');
  console.log('╚═══════════════════════════════════════════╝');
  console.log('');
  console.log(`  SMTP:        ${SMTP_HOST}:${SMTP_PORT}`);
  console.log(`  De:          "${SMTP_FROM_NAME}" <${SMTP_FROM}>`);
  console.log(`  Para:        ${args.to}`);
  console.log(`  Assunto:     ${subject}`);
  console.log(`  Template:    welcome-email.hbs`);
  console.log('');

  try {
    await transporter.verify();
    console.log('  ✅ Conexão SMTP verificada');
  } catch (err) {
    console.error('  ❌ MailHog não está acessível em', `${SMTP_HOST}:${SMTP_PORT}`);
    console.error('  ');
    console.error('  Suba o MailHog primeiro:');
    console.error('    docker compose up mailhog -d');
    console.error('  ');
    console.error('  Erro:', err.message);
    process.exit(1);
  }

  await transporter.sendMail({
    from: `"${SMTP_FROM_NAME}" <${SMTP_FROM}>`,
    to: args.to,
    subject,
    html,
  });

  console.log('');
  console.log('  🚀 E-mail enviado com sucesso!');
  console.log('');
  console.log('  ┌─────────────────────────────────────┐');
  console.log('  │  📬  Abra o MailHog para visualizar  │');
  console.log('  │  → http://localhost:8025             │');
  console.log('  └─────────────────────────────────────┘');
  console.log('');
}

main().catch((err) => {
  console.error('❌ Erro inesperado:', err.message);
  process.exit(1);
});
