/**
 * utils/cookie.ts — o token vai num cookie `httpOnly`: o JavaScript da página
 * não consegue lê-lo, o que protege a sessão contra roubo por XSS.
 */
import type { CookieOptions, Response } from "express";
import { env, isProd } from "../config/env.js";

export const COOKIE_NAME = "nx_token";

const baseOptions = (): CookieOptions => ({
  httpOnly: true,
  // SameSite=None obriga a HTTPS (secure), por isso é forçado nesse caso.
  secure: isProd || env.COOKIE_SAMESITE === "none",
  sameSite: env.COOKIE_SAMESITE,
  path: "/",
});

/** `maxAgeMs` indefinido = cookie de sessão (apaga-se ao fechar o navegador). */
export const setAuthCookie = (res: Response, token: string, maxAgeMs?: number) =>
  res.cookie(COOKIE_NAME, token, { ...baseOptions(), ...(maxAgeMs ? { maxAge: maxAgeMs } : {}) });

export const clearAuthCookie = (res: Response) => res.clearCookie(COOKIE_NAME, baseOptions());
