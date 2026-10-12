/**
 * middleware/auth.ts — protege rotas: só deixa passar quem tem um JWT válido.
 * Lê o token do cookie httpOnly (ou do cabeçalho "Authorization: Bearer ...",
 * útil para testes e apps móveis) e guarda o id em `req.userId`.
 *
 * Além de verificar a assinatura, confere na base de dados que:
 *  - a conta ainda existe;
 *  - o token não foi emitido ANTES de as sessões terem sido revogadas (mudança/reposição da
 *    palavra-passe, associação ao Google). Assim, quem roubou uma sessão perde o acesso.
 */
import type { NextFunction, Request, Response } from "express";
import { usersRepository } from "../repositories/users.repository.js";
import { HttpError } from "../utils/httpError.js";
import { COOKIE_NAME } from "../utils/cookie.js";
import { verifyToken } from "../utils/jwt.js";

const expired = () => new HttpError(401, "Sessão inválida ou expirada. Inicie sessão novamente.");

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  // Respostas com sessão são privadas: nunca ficam em cache do navegador nem de proxies.
  res.setHeader("Cache-Control", "no-store");

  const header = req.headers.authorization;
  const bearer = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  const token: string | undefined = req.cookies?.[COOKIE_NAME] ?? bearer;

  const claims = token ? verifyToken(token) : null;
  if (!claims) throw expired();

  const state = await usersRepository.getSessionState(claims.userId);
  if (!state) throw expired(); // conta apagada
  // `iat` está em segundos: compara-se em segundos para que um token emitido logo após a revogação continue válido.
  if (state.validAfter && claims.issuedAt < Math.floor(state.validAfter.getTime() / 1000)) throw expired();

  req.userId = claims.userId;
  next();
};
