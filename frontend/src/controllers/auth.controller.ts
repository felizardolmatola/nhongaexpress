/**
 * controllers/auth.controller.ts — camada HTTP: valida a entrada (esquemas zod),
 * chama o serviço e devolve a resposta. A lógica de negócio fica no serviço.
 */
import type { Request, Response } from "express";
import { z } from "zod";
import { authService, type Session } from "../services/auth.service.js";
import { clearAuthCookie, setAuthCookie } from "../utils/cookie.js";
import { verifyGoogle } from "../utils/socialProviders.js";
import { parseEmail, parseIdentifier, parsePhone } from "../utils/identifier.js";

/* ---- Esquemas de validação (as mensagens aparecem no formulário) ---- */

const identifier = z
  .string({ error: "Insira o seu e-mail ou telefone." })
  .trim()
  .min(1, "Insira o seu e-mail ou telefone.")
  .refine((v) => parseIdentifier(v) !== null, "E-mail ou telefone inválido. Telefone: 8X XXX XXXX.");

/** Mín. 8 caracteres, com letra e número. Máx. 72 bytes (limite do bcrypt). */
const password = z
  .string({ error: "Insira a sua palavra-passe." })
  .min(8, "Use pelo menos 8 caracteres.")
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), "Use letras e pelo menos um número.")
  .refine((v) => Buffer.byteLength(v, "utf8") <= 72, "Palavra-passe demasiado longa.");

/** E-mail OBRIGATÓRIO no registo: é para onde vai o código de recuperação da palavra-passe. */
const requiredEmail = z
  .string({ error: "Insira o seu e-mail." })
  .trim()
  .min(1, "Insira o seu e-mail.")
  .refine((v) => parseEmail(v) !== null, "E-mail inválido. Use o formato nome@dominio.com.");

/** Telefone OPCIONAL no registo (8X XXX XXXX, com ou sem +258). */
const optionalPhone = z
  .string()
  .trim()
  .refine((v) => v === "" || parsePhone(v) !== null, "Telefone inválido. Use 8X XXX XXXX.")
  .optional();

export const registerSchema = z.object({
  name: z.string({ error: "Insira o seu nome completo." }).trim().min(2, "Insira o seu nome completo.").max(100),
  email: requiredEmail,
  phone: optionalPhone,
  password,
});

export const loginSchema = z.object({
  identifier,
  // No login não exigimos a "força": só que exista (a comparação é feita com o hash).
  password: z.string({ error: "Insira a sua palavra-passe." }).min(1, "Insira a sua palavra-passe.").max(200),
  remember: z.boolean().default(true),
});

/**
 * Edição do perfil: todos os campos são opcionais, mas tem de vir pelo menos um.
 * Telefone vazio ("") remove o telefone. O e-mail é obrigatório e não pode ser removido.
 */
export const updateProfileSchema = z
  .object({
    name: z.string().trim().min(2, "Insira o seu nome completo.").max(100, "Nome demasiado longo.").optional(),
    email: z.string().trim().refine((v) => v === "" || parseEmail(v) !== null, "E-mail inválido.").optional(),
    phone: z.string().trim().refine((v) => v === "" || parsePhone(v) !== null, "Telefone inválido. Use 8X XXX XXXX.").optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: "Não há nada para atualizar.", path: ["form"] });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string({ error: "Insira a palavra-passe atual." }).min(1, "Insira a palavra-passe atual.").max(200),
    newPassword: password,
  })
  .refine((d) => d.currentPassword !== d.newPassword, {
    message: "A nova palavra-passe tem de ser diferente da atual.",
    path: ["newPassword"],
  });

/** Google: access token devolvido pelo popup (validado no servidor). */
export const googleLoginSchema = z.object({
  accessToken: z.string({ error: "Token Google em falta." }).min(10, "Token Google inválido.").max(4096, "Token Google inválido."),
});

export const forgotPasswordSchema = z.object({ identifier });

export const resetPasswordSchema = z.object({
  identifier,
  code: z.string({ error: "Indique o código recebido." }).trim().regex(/^\d{6}$/, "O código tem 6 dígitos."),
  newPassword: password,
});

/* ---- Handlers ---- */

/** Guarda o token no cookie e devolve só os dados públicos do utilizador. */
const reply = (res: Response, status: number, session: Session) => {
  setAuthCookie(res, session.token, session.maxAgeMs);
  res.status(status).json({ user: session.user });
};

export const authController = {
  register: async (req: Request, res: Response) => reply(res, 201, await authService.register(req.body)),
  login: async (req: Request, res: Response) => reply(res, 200, await authService.login(req.body)),
  googleLogin: async (req: Request, res: Response) =>
    reply(res, 200, await authService.googleLogin(await verifyGoogle(req.body.accessToken))),
  me: async (req: Request, res: Response) => {
    res.json({ user: await authService.me(req.userId!) });
  },
  updateProfile: async (req: Request, res: Response) => {
    res.json({ user: await authService.updateProfile(req.userId!, req.body) });
  },
  changePassword: async (req: Request, res: Response) => {
    // As sessões antigas foram revogadas: este dispositivo recebe um cookie novo e continua com sessão.
    const session = await authService.changePassword(req.userId!, req.body);
    setAuthCookie(res, session.token, session.maxAgeMs);
    res.status(204).end();
  },
  forgotPassword: async (req: Request, res: Response) => {
    await authService.forgotPassword(req.body);
    res.status(204).end();
  },
  resetPassword: async (req: Request, res: Response) => {
    await authService.resetPassword(req.body);
    res.status(204).end();
  },
  logout: (_req: Request, res: Response) => {
    clearAuthCookie(res);
    res.status(204).end();
  },
};
