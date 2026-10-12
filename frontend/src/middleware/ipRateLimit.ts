/**
 * middleware/ipRateLimit.ts — limite de pedidos por IP, em memória (sem dependências).
 * Janela deslizante: no máximo `max` pedidos por `windowMs` por IP; acima disso responde 429 com Retry-After.
 * Atenção: atrás de um proxy (Render, Railway, Nginx...) o servidor tem de ter `app.set("trust proxy", 1)`,
 * senão `req.ip` é o do proxy e todos os clientes partilham o mesmo limite.
 * Em memória = por instância: com várias instâncias o limite é por instância (suficiente contra abuso simples).
 */
import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../utils/httpError.js";

export const ipRateLimit = ({ windowMs, max, message }: { windowMs: number; max: number; message: string }) => {
  const hits = new Map<string, number[]>();
  // Limpeza periódica para o mapa não crescer sem fim; unref() não impede o processo de terminar.
  setInterval(() => {
    const cutoff = Date.now() - windowMs;
    for (const [key, times] of hits) {
      const recent = times.filter((t) => t > cutoff);
      if (recent.length) hits.set(key, recent); else hits.delete(key);
    }
  }, windowMs).unref();

  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip ?? "unknown";
    const now = Date.now();
    const recent = (hits.get(key) ?? []).filter((t) => t > now - windowMs);
    if (recent.length >= max) {
      res.setHeader("Retry-After", String(Math.max(1, Math.ceil((recent[0] + windowMs - now) / 1000))));
      return next(new HttpError(429, message));
    }
    recent.push(now);
    hits.set(key, recent);
    next();
  };
};
