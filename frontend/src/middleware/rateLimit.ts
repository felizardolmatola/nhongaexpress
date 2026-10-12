/**
 * middleware/rateLimit.ts — limita pedidos por IP para travar abusos.
 * - `apiLimiter`: geral (toda a API).
 * - `authLimiter`: mais apertado em registo/login (trava adivinhar palavras-passe
 *   e criar contas em massa). Só conta pedidos que falham no login/registo.
 */
import rateLimit from "express-rate-limit";

const message = { message: "Demasiados pedidos. Tente novamente dentro de alguns minutos." };

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message,
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message,
});

/**
 * Criar contas: conta TODOS os pedidos (também os bem-sucedidos), 10 por hora por IP.
 * O `authLimiter` ignora os sucessos (skipSuccessfulRequests), por isso sozinho não travava
 * a criação de contas em massa.
 */
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message,
});

/** Pedir códigos de recuperação: conta TODOS os pedidos (também os bem-sucedidos), 5 por 15 min por IP. */
export const forgotLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message,
});

/**
 * Criar pedidos: 10 por 10 min POR UTILIZADOR (e não por IP, porque redes móveis partilham IPs).
 * Só é usado depois do `requireAuth`, por isso `req.userId` já existe.
 */
export const orderLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 10,
  keyGenerator: (req) => req.userId ?? "anon",
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message,
});
