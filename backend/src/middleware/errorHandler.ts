/**
 * middleware/errorHandler.ts — último elo da cadeia: transforma qualquer erro
 * numa resposta JSON. Erros inesperados são registados no servidor, mas o
 * cliente só recebe uma mensagem genérica (nunca stack traces nem detalhes).
 */
import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import { HttpError } from "../utils/httpError.js";

export const notFound: RequestHandler = (_req, res) => {
  res.status(404).json({ message: "Rota não encontrada." });
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    return void res.status(err.status).json({ message: err.message, ...(err.fields ? { fields: err.fields } : {}) });
  }
  // Corpo inválido nas rotas que usam `.parse()` direto (painel admin): 400 com a mensagem por campo, não 500.
  if (err instanceof ZodError) {
    const fields: Record<string, string> = {};
    for (const issue of err.issues) fields[String(issue.path[0] ?? "form")] ??= issue.message;
    return void res.status(400).json({ message: "Dados inválidos.", fields });
  }
  // JSON malformado no corpo do pedido.
  if (err?.type === "entity.parse.failed") return void res.status(400).json({ message: "JSON inválido." });
  if (err?.type === "entity.too.large") return void res.status(413).json({ message: "Pedido demasiado grande." });

  console.error("[erro]", err);
  res.status(500).json({ message: "Erro interno. Tente novamente mais tarde." });
};
