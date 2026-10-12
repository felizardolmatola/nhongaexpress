/**
 * utils/notifier.ts — envia mensagens (ao cliente e ao administrador) (e-mail por SMTP, SMS por webhook).
 * - Sem configuração, em desenvolvimento a mensagem é escrita na consola do servidor
 *   (assim o fluxo pode ser testado sem serviços externos).
 * - Sem configuração, em produção NADA é enviado e fica um erro no log do servidor.
 * Os erros de envio nunca chegam ao cliente (não revelam se a conta existe).
 */
import nodemailer from "nodemailer";
import { env, isProd } from "../config/env.js";

const mailer = env.SMTP_HOST
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
      // Limites de tempo: um SMTP lento nunca deixa tarefas penduradas para sempre.
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    })
  : null;

/** Sem canal configurado: mostra a mensagem na consola (só em desenvolvimento). */
const fallback = (channel: string, to: string, text: string) => {
  if (isProd) console.error(`[notifier] ${channel} não configurado — mensagem para ${to} NÃO foi enviada.`);
  else console.log(`\n[notifier:${channel}] para ${to}\n${text}\n`);
};

export const sendEmail = async (to: string, subject: string, text: string): Promise<void> => {
  if (!mailer) return fallback("e-mail", to, `${subject}\n\n${text}`);
  await mailer.sendMail({ from: env.MAIL_FROM, to, subject, text });
};

export const sendSms = async (to: string, message: string): Promise<void> => {
  if (!env.SMS_WEBHOOK_URL) return fallback("sms", to, message);
  const res = await fetch(env.SMS_WEBHOOK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(env.SMS_WEBHOOK_TOKEN ? { Authorization: `Bearer ${env.SMS_WEBHOOK_TOKEN}` } : {}),
    },
    body: JSON.stringify({ to, message }),
  });
  if (!res.ok) throw new Error(`SMS webhook respondeu ${res.status}`);
};
