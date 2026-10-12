/**
 * middleware/errorHandler.ts — último elo da cadeia: transforma qualquer erro
 * numa resposta JSON. Erros inesperados são registados no servidor, mas o
 * cliente só recebe uma mensagem genérica (nunca stack traces nem detalhes).
 */
import type { ErrorRequestHandler, RequestHandler } from "express";
import { HttpError } from "../utils/httpError.js";

export const notFound: RequestHandler = (_req, res) => {
  res.status(404).json({ message: "Rota não encontrada." });
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    return void res.status(err.status).json({ message: err.message, ...(err.fields ? { fields: err.fields } : {}) });
  }
  // JSON malformado no corpo do pedido.
  if (err?.type === "entity.parse.failed") return void res.status(400).json({ message: "JSON inválido." });
  if (err?.type === "entity.too.large") return void res.status(413).json({ message: "Pedido demasiado grande." });

  console.error("[erro]", err);
  res.status(500).json({ message: "Erro interno. Tente novamente mais tarde." });
};
