/**
 * middleware/adminAuth.ts — protege TODA a área /api/admin.
 *
 * O administrador usa o MESMO login da loja (cookie httpOnly `nx_token`, ver auth.ts).
 * A diferença está só na conta: tem `role = 'admin'` na tabela `users`.
 * A função é lida da base de dados em cada pedido (não vem no token), por isso
 * retirar a função a alguém tem efeito imediato, mesmo com a sessão aberta.
 */
import type { NextFunction, Request, RequestHandler, Response } from "express";
import { env } from "../config/env.js";
import { usersRepository } from "../repositories/users.repository.js";
import { HttpError } from "../utils/httpError.js";
import { requireAuth } from "./auth.js";

const clientOrigin = new URL(env.CLIENT_ORIGIN).origin;

/**
 * Defesa extra contra CSRF: pedidos que alteram dados só são aceites se vierem do
 * nosso frontend. (GET/HEAD/OPTIONS não alteram nada, por isso passam.)
 */
export const sameOriginOnly: RequestHandler = (req, _res, next) => {
  const readOnly = req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS";
  const origin = req.headers.origin;
  if (!readOnly && origin && origin !== clientOrigin) return next(new HttpError(403, "Origem não autorizada."));
  next();
};

/** 2.º passo: a sessão já é válida (requireAuth); falta confirmar que a conta é de administrador. */
const requireAdminRole = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const user = await usersRepository.findById(req.userId!);
    if (!user) throw new HttpError(401, "Sessão inválida ou expirada. Inicie sessão novamente.");
    if (user.role !== "admin") throw new HttpError(403, "Esta conta não tem acesso ao painel administrativo.");
    req.admin = { id: user.id, name: user.name, email: user.email, phone: user.phone, role: "admin" };
    next();
  } catch (error) {
    next(error);
  }
};

/** Uso: `router.use(requireAdmin)` — 401 sem sessão, 403 com sessão mas sem ser administrador. */
export const requireAdmin: RequestHandler[] = [requireAuth, requireAdminRole];
