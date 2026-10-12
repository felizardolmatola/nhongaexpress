/**
 * social.ts — login com Google (único fornecedor social).
 *
 * Fluxo: abre o popup do Google -> recebe um token -> envia-o ao backend através de
 * `api.googleLogin` (mesmo cliente HTTP e mesmo cookie httpOnly do login normal)
 * -> o backend valida o token, cria/associa a conta e abre a sessão. Devolve o utilizador.
 *
 * Variável do frontend (.env):
 *   VITE_GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
 */
import { api, type ApiUser } from "./api";

export type SocialProvider = "google";

/** Lançado quando o utilizador fecha o popup: não deve ser mostrado como erro. */
export class SocialCancelled extends Error {
  constructor() { super("cancelled"); }
}

declare global {
  interface Window { google?: any }
}

const GOOGLE_SRC = "https://accounts.google.com/gsi/client";

const scripts: Record<string, Promise<void>> = {};
function loadScript(src: string): Promise<void> {
  if (!scripts[src]) {
    scripts[src] = new Promise<void>((resolve, reject) => {
      const el = document.createElement("script");
      el.src = src;
      el.async = true;
      el.onload = () => resolve();
      el.onerror = () => {
        delete scripts[src];
        reject(new Error("Não foi possível carregar o serviço de login. Verifique a ligação."));
      };
      document.head.appendChild(el);
    });
  }
  return scripts[src];
}

/** Pré-carrega o SDK do Google (chamar ao abrir o ecrã de login) para o popup abrir logo ao clicar. */
export function preloadSocial(): void {
  loadScript(GOOGLE_SRC).catch(() => {});
}

async function googleAccessToken(): Promise<string> {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
  if (!clientId) throw new Error("O login com Google ainda não está configurado.");
  await loadScript(GOOGLE_SRC);
  return new Promise<string>((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: "openid email profile",
      callback: (r: any) =>
        r?.access_token ? resolve(r.access_token) : reject(new Error("Falha no login com Google.")),
      error_callback: (e: any) =>
        e?.type === "popup_closed" ? reject(new SocialCancelled()) : reject(new Error("Falha no login com Google.")),
    });
    client.requestAccessToken();
  });
}

/** Faz o login com Google e devolve o utilizador da sessão aberta no backend. */
export async function socialLogin(_provider: SocialProvider = "google"): Promise<ApiUser> {
  return (await api.googleLogin({ accessToken: await googleAccessToken() })).user;
}
