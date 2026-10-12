/**
 * middleware/validate.ts — valida o corpo (JSON) do pedido com um esquema zod.
 * Se falhar, responde 400 com o erro por campo (o frontend mostra junto ao input).
 * Campos desconhecidos são descartados, evitando "mass assignment".
 */
import type { NextFunction, Request, Response } from "express";
import type { ZodType } from "zod";
import { HttpError } from "../utils/httpError.js";

export const validateBody = (schema: ZodType) => (req: Request, _res: Response, next: NextFunction) => {
  const result = schema.safeParse(req.body ?? {});
  if (!result.success) {
    const fields: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const key = String(issue.path[0] ?? "form");
      fields[key] ??= issue.message; // guarda a 1.ª mensagem de cada campo
    }
    throw new HttpError(400, "Dados inválidos.", fields);
  }
  req.body = result.data;
  next();
};
