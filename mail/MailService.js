// Node.js equivalent of mail/MailService.php
// Uses nodemailer to send emails with a similar API:
//   MailService.sendMail(to, subject, htmlBody, textBody?, opts?)
//   MailService.sendContactMessage(name, email, message, to?, subject?)

const nodemailer = require('nodemailer');
const cfg = require('./config');

class MailService {
  static async createTransport() {
    if (cfg.transport !== 'smtp') {
      // For now we mirror PHP: default to SMTP; other transports could be added later.
    }

    const secure = cfg.smtp_secure === 'ssl';
    const requireTLS = cfg.smtp_secure === 'tls';

    return nodemailer.createTransport({
      host: cfg.smtp_host || '',
      port: cfg.smtp_port || 587,
      secure, // true for port 465, false for others
      requireTLS,
      auth: {
        user: cfg.smtp_user || '',
        pass: cfg.smtp_pass || '',
      },
    });
  }

  // Universal mail sender (no attachments by design)
  static async sendMail(to, subject, htmlBody, textBody = null, opts = {}) {
    const transporter = await this.createTransport();

    const fromEmail = opts.from_email || cfg.from_email || 'no-reply@localhost';
    const fromName = opts.from_name || cfg.from_name || 'App';

    let toList = [];
    if (to) {
      if (typeof to === 'string') {
        toList = to.split(',').map((s) => s.trim()).filter(Boolean);
      } else if (Array.isArray(to)) {
        toList = to;
      }
    } else if (process.env.MAIL_TO) {
      toList = process.env.MAIL_TO.split(',').map((s) => s.trim()).filter(Boolean);
    }

    if (!toList.length) {
      return { success: false, error: 'No recipients defined (set MAIL_TO or pass $to)' };
    }

    const message = {
      from: `"${fromName}" <${fromEmail}>`,
      to: toList,
      subject,
      html: htmlBody,
      text: textBody || htmlBody.replace(/<\/?[^>]+(>|$)/g, ''),
    };

    if (opts.reply_to) {
      message.replyTo = opts.reply_to;
    } else if (cfg.reply_to) {
      message.replyTo = cfg.reply_to;
    }

    if (opts.cc) {
      message.cc = Array.isArray(opts.cc) ? opts.cc : [opts.cc];
    }
    if (opts.bcc) {
      message.bcc = Array.isArray(opts.bcc) ? opts.bcc : [opts.bcc];
    }

    try {
      await transporter.sendMail(message);
      return { success: true };
    } catch (e) {
      return { success: false, error: `Nodemailer error: ${e.message || String(e)}` };
    }
  }

  // $to can be: string | string[] | null
  static async sendContactMessage(name, email, messageBody, to = null, subject = 'New contact form') {
    const safeName = String(name || '');
    const safeEmail = String(email || '');
    const safeBody = String(messageBody || '');

    const html =
      `<p><strong>Name:</strong> ${escapeHtml(safeName)}</p>` +
      `<p><strong>Email:</strong> ${escapeHtml(safeEmail)}</p><hr>` +
      `${escapeHtml(safeBody).replace(/\n/g, '<br>')}`;

    const text =
      `Name: ${safeName}\n` +
      `Email: ${safeEmail}\n\n` +
      safeBody;

    return this.sendMail(to, subject, html, text, {
      reply_to: safeEmail,
    });
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

module.exports = MailService;



