/**
 * utils/jwt.ts — criação e verificação dos tokens de sessão (JWT).
 * - Algoritmo fixado em HS256 na assinatura E na verificação (evita o ataque
 *   "alg: none" / troca de algoritmo).
 * - `issuer` e `audience` impedem que um token de outro sistema seja aceite.
 * - O token só leva o id do utilizador (`sub`): nenhum dado sensível.
 */
import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../config/env.js";

const ISSUER = "nhongaexpress-api";
const AUDIENCE = "nhongaexpress-web";

export const signToken = (userId: string, expiresIn: string): string =>
  jwt.sign({}, env.JWT_SECRET, {
    algorithm: "HS256",
    subject: userId,
    issuer: ISSUER,
    audience: AUDIENCE,
    expiresIn: expiresIn as SignOptions["expiresIn"],
  });

/**
 * Devolve o id do utilizador e o instante de emissão do token (`iat`, em segundos) se o token for válido;
 * caso contrário `null`. O `iat` serve para recusar tokens emitidos ANTES de as sessões terem sido
 * revogadas (mudança de palavra-passe, etc.) — ver middleware/auth.ts.
 */
export const verifyToken = (token: string): { userId: string; issuedAt: number } | null => {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET, {
      algorithms: ["HS256"],
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    if (typeof payload !== "object" || typeof payload.sub !== "string" || typeof payload.iat !== "number") return null;
    return { userId: payload.sub, issuedAt: payload.iat };
  } catch {
    return null; // expirado, adulterado, formato errado...
  }
};
