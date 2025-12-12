// Node.js equivalent of mail/config.php
// Reads configuration from environment variables, optionally loading from .env.

const fs = require('fs');
const path = require('path');

function envVal(key, def = null) {
  const v = process.env[key];
  return v === undefined || v === null || v === '' ? def : v;
}

function loadDotenvIfNeeded(keys) {
  const missing = keys.filter((k) => !process.env[k]);
  if (!missing.length) return;

  const envPath = path.resolve(__dirname, '..', '..', '.env');
  if (!fs.existsSync(envPath)) return;

  const content = fs.readFileSync(envPath, 'utf8');
  const lines = content.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const [kRaw, vRaw] = line.split('=', 2);
    const k = kRaw.trim();
    if (!k) continue;
    let v = (vRaw || '').trim();
    v = v.replace(/^["']/, '').replace(/["']$/, '');
    if (!process.env[k]) {
      process.env[k] = v;
    }
  }
}

loadDotenvIfNeeded([
  'MAIL_TRANSPORT',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_SECURE',
  'SMTP_USER',
  'SMTP_PASS',
  'MAIL_FROM',
  'MAIL_FROM_NAME',
  'MAIL_REPLY_TO',
  'MAIL_TO',
  'DKIM_DOMAIN',
  'DKIM_SELECTOR',
  'DKIM_PRIVATE_KEY_PATH',
]);

const transport = envVal('MAIL_TRANSPORT', 'smtp');
const smtp_host = envVal('SMTP_HOST');
const smtp_port = Number(envVal('SMTP_PORT', 587));
const smtp_secure = envVal('SMTP_SECURE', 'tls');
const smtp_user = envVal('SMTP_USER');
const smtp_pass = envVal('SMTP_PASS');

const from_email = envVal('MAIL_FROM', 'no-reply@localhost');
const from_name = envVal('MAIL_FROM_NAME', 'App');
const reply_to = envVal('MAIL_REPLY_TO');

const dkim_domain = envVal('DKIM_DOMAIN');
const dkim_selector = envVal('DKIM_SELECTOR');
const dkim_private_key_path = envVal('DKIM_PRIVATE_KEY_PATH');

module.exports = {
  transport,
  smtp_host,
  smtp_port,
  smtp_secure,
  smtp_user,
  smtp_pass,
  from_email,
  from_name,
  reply_to,
  dkim_domain,
  dkim_selector,
  dkim_private_key_path,
};



