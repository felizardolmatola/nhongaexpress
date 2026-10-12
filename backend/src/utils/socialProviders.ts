/**
 * utils/socialProviders.ts — valida, NO SERVIDOR, o token do Google.
 * Nunca se confia no que o frontend diz (nome, e-mail...): só no que o Google confirma.
 * Devolve um perfil normalizado; quem decide criar/associar a conta é o authService.
 */
import { env } from "../config/env.js";
import { HttpError } from "./httpError.js";

export type GoogleProfile = {
  /** Id estável do utilizador no Google (`sub`). O e-mail pode mudar; este não. */
  googleId: string;
  email: string | null;
  /** Só um e-mail verificado pelo Google pode ser usado para associar a uma conta existente. */
  emailVerified: boolean;
  name: string | null;
};

const TIMEOUT_MS = 8000;

const notConfigured = () => new HttpError(503, "O login com Google não está disponível de momento.");
const invalid = () => new HttpError(401, "Não foi possível validar o login com Google.");

const getJson = async (url: string, headers?: Record<string, string>): Promise<Record<string, unknown> | null> => {
  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
    return res.ok ? ((await res.json()) as Record<string, unknown>) : null;
  } catch {
    return null;
  }
};

const isTrue = (v: unknown) => v === true || v === "true";
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

/** O access token tem de ter sido emitido para a NOSSA app (`aud`); depois lemos o perfil. */
export const verifyGoogle = async (accessToken: string): Promise<GoogleProfile> => {
  if (!env.GOOGLE_CLIENT_ID) throw notConfigured();
  const info = await getJson(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`);
  if (!info || info.aud !== env.GOOGLE_CLIENT_ID) throw invalid();

  const p = await getJson("https://www.googleapis.com/oauth2/v3/userinfo", { Authorization: `Bearer ${accessToken}` });
  const sub = str(p?.sub);
  if (!p || !sub) throw invalid();
  return { googleId: sub, email: str(p.email), emailVerified: isTrue(p.email_verified), name: str(p.name) };
};
