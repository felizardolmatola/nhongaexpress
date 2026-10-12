/**
 * social.ts — login com Google e Apple (somente estes dois).
 *
 * Fluxo: abre o popup do fornecedor -> recebe um token -> envia-o ao backend através de
 * `api.googleLogin` / `api.appleLogin` (mesmo cliente HTTP e mesmo cookie httpOnly do login normal)
 * -> o backend valida o token, cria/associa a conta e abre a sessão. Devolve o utilizador.
 *
 * Variáveis do frontend (.env):
 *   VITE_GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
 *   VITE_APPLE_CLIENT_ID=com.nhongaexpress.web        (Services ID da Apple)
 *   VITE_APPLE_REDIRECT_URI=https://o-seu-dominio.com (HTTPS, registado na Apple)
 */
import { api, type ApiUser } from "./api";

export type SocialProvider = "google" | "apple";

/** Lançado quando o utilizador fecha o popup: não deve ser mostrado como erro. */
export class SocialCancelled extends Error {
  constructor() { super("cancelled"); }
}

declare global {
  interface Window { google?: any; AppleID?: any }
}

const GOOGLE_SRC = "https://accounts.google.com/gsi/client";
const APPLE_SRC = "https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js";

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

/** Pré-carrega os SDKs (chamar ao abrir o ecrã de login) para o popup abrir logo ao clicar. */
export function preloadSocial(): void {
  loadScript(GOOGLE_SRC).catch(() => {});
  loadScript(APPLE_SRC).catch(() => {});
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

async function appleIdToken(): Promise<{ idToken: string; name?: string }> {
  const clientId = import.meta.env.VITE_APPLE_CLIENT_ID as string | undefined;
  if (!clientId) throw new Error("O login com Apple ainda não está configurado.");
  const redirectURI = (import.meta.env.VITE_APPLE_REDIRECT_URI as string | undefined) ?? window.location.origin;
  await loadScript(APPLE_SRC);
  window.AppleID.auth.init({ clientId, scope: "name email", redirectURI, usePopup: true });
  try {
    const r = await window.AppleID.auth.signIn();
    // A Apple só envia o nome na PRIMEIRA vez que o utilizador autoriza a app.
    const name = [r?.user?.name?.firstName, r?.user?.name?.lastName].filter(Boolean).join(" ") || undefined;
    return { idToken: r.authorization.id_token, name };
  } catch (e: any) {
    if (e?.error === "popup_closed_by_user" || e?.error === "user_cancelled_authorize") throw new SocialCancelled();
    throw new Error("Falha no login com Apple.");
  }
}

/** Faz o login social completo e devolve o utilizador da sessão aberta no backend. */
export async function socialLogin(provider: SocialProvider): Promise<ApiUser> {
  if (provider === "google") return (await api.googleLogin({ accessToken: await googleAccessToken() })).user;
  const { idToken, name } = await appleIdToken();
  return (await api.appleLogin({ idToken, ...(name ? { name } : {}) })).user;
}
