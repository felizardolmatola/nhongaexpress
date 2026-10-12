/**
 * config/env.ts — lê e VALIDA as variáveis de ambiente (.env) ao arrancar.
 * Se algo estiver em falta ou for inseguro (ex.: JWT_SECRET curto), o servidor
 * não arranca e mostra uma mensagem clara, em vez de falhar mais tarde.
 */
import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  CLIENT_ORIGIN: z.string().url(),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20, "chave service_role em falta"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET deve ter pelo menos 32 caracteres"),
  JWT_EXPIRES_IN: z.string().default("7d"),
  JWT_SHORT_EXPIRES_IN: z.string().default("12h"),
  COOKIE_SAMESITE: z.enum(["lax", "strict", "none"]).default("lax"),
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  // --- Login com Google (opcional: sem isto, a rota /auth/google responde 503) ---
  // Google: "ID de cliente OAuth" (Aplicação Web).
  GOOGLE_CLIENT_ID: z.string().optional(),
  // --- Envio do código de recuperação (todos opcionais) ---
  // E-mail por SMTP. Sem isto, em desenvolvimento o código aparece na consola do servidor.
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().default("NhongaExpress <no-reply@nhongaexpress.local>"),
  // Quem recebe os avisos de novo pedido / novo utilizador (vários e-mails separados por vírgula).
  // Vazio = usa o e-mail das contas com role "admin".
  ADMIN_NOTIFY_EMAIL: z.string().optional(),
  // SMS: o backend faz POST { to, message } a este endereço (gateway SMS, Zapier, função própria...).
  SMS_WEBHOOK_URL: z.string().url().optional().or(z.literal("")),
  SMS_WEBHOOK_TOKEN: z.string().optional(),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error("Configuração inválida no ficheiro .env:");
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === "production";
