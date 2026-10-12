/**
 * route.ts — ONDE fica cada metade da aplicação.
 *
 *   /            → loja (clientes). Navega por estado, sem mudar o endereço.
 *   /admin/...   → painel do administrador. Tem URLs próprios (/admin/produtos, ...).
 *
 * São duas "apps" separadas: main.tsx só carrega o código e o CSS de UMA delas por
 * página. Para passar de uma à outra usa-se SEMPRE uma navegação completa
 * (window.location), nunca estado — assim os estilos e o código nunca se misturam.
 *
 * O login é um só (o da loja). Quem abre /admin sem sessão é enviado para
 * `/?next=admin`; depois de entrar, a loja devolve os administradores a /admin.
 */
export const ADMIN_BASE = "/admin";

/** "/admin" e "/admin/qualquer-coisa" são do painel; "/administrador" ou "/adminx" não. */
export const isAdminPath = (path: string = window.location.pathname): boolean =>
  path === ADMIN_BASE || path.startsWith(`${ADMIN_BASE}/`);

/** Página de login da loja, a pedir para voltar ao painel depois de entrar. */
export const ADMIN_LOGIN_URL = "/?next=admin";

/** true quando a loja foi aberta a partir do painel (/?next=admin). */
export const wantsAdmin = (): boolean => new URLSearchParams(window.location.search).get("next") === "admin";

/** Tira o ?next=admin do endereço (sem recarregar a página). */
export const clearNextParam = (): void => {
  if (wantsAdmin()) window.history.replaceState(null, "", window.location.pathname);
};
