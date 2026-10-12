/**
 * api.ts — cliente HTTP do frontend para o backend (pasta /backend).
 * - Em desenvolvimento, o Vite reencaminha "/api" para http://localhost:4000
 *   (ver vite.config.ts), por isso não há problemas de CORS.
 * - Em produção, defina VITE_API_URL com o endereço da API (ex.: https://api.exemplo.com).
 * - `credentials: "include"` envia/recebe o cookie httpOnly com o token de sessão;
 *   o frontend nunca vê nem guarda o JWT.
 */
const BASE = import.meta.env.VITE_API_URL ?? "";

/** Dados públicos do utilizador devolvidos pela API (nunca inclui a palavra-passe). */
/** `role` = "admin" abre o acesso ao painel (/admin); o login é o mesmo dos clientes. */
export type ApiUser = { id: string; name: string; email: string | null; phone: string | null; role: "customer" | "admin"; createdAt: string };

/** Erro de API: `fields` traz a mensagem por campo (identifier, email, phone, password, name). */
export class ApiError extends Error {
  constructor(public status: number, message: string, public fields?: Record<string, string>) {
    super(message);
    // Sem isto, com `target` ES5 o `instanceof ApiError` falha e toda a mensagem do servidor cai no texto genérico.
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

/** Resultado de POST /api/orders/validate (ver `api.validateCart`). */
export type CartLineCheck = {
  productId: string; name: string | null; requested: number; available: number; unitPrice: number | null;
  status: "ok" | "unavailable" | "out_of_stock" | "insufficient" | "over_limit"; message: string | null;
};
export type CartCheck = { ok: boolean; items: CartLineCheck[]; subtotal: number };

async function request<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/api${path}`, {
      method: init.method ?? "GET",
      credentials: "include",
      headers: init.body ? { "Content-Type": "application/json" } : undefined,
      body: init.body ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new ApiError(0, "Não foi possível ligar ao servidor. Verifique a ligação e tente novamente.");
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.message ?? "Ocorreu um erro. Tente novamente.", data.fields);
  return data as T;
}

export const api = {
  /** E-mail obrigatório (recebe o código de recuperação); telefone opcional (+258XXXXXXXXX). */
  register: (body: { name: string; email: string; phone?: string; password: string }) =>
    request<{ user: ApiUser }>("/auth/register", { method: "POST", body }),
  login: (body: { identifier: string; password: string; remember: boolean }) =>
    request<{ user: ApiUser }>("/auth/login", { method: "POST", body }),
  /** Devolve o utilizador da sessão atual (ou lança ApiError 401 se não houver sessão). */
  me: () => request<{ user: ApiUser }>("/auth/me"),
  /** Edita o perfil. Só os campos enviados mudam; "" apaga o e-mail/telefone (se sobrar um contacto). */
  updateProfile: (body: { name?: string; email?: string; phone?: string }) =>
    request<{ user: ApiUser }>("/auth/me", { method: "PATCH", body }),
  changePassword: (body: { currentPassword: string; newPassword: string }) =>
    request<void>("/auth/change-password", { method: "POST", body }),
  /** Pede o código de recuperação (por e-mail/SMS). Responde sempre OK, exista a conta ou não. */
  forgotPassword: (body: { identifier: string }) =>
    request<void>("/auth/forgot-password", { method: "POST", body }),
  /** Confirma o código de 6 dígitos e define a nova palavra-passe. */
  resetPassword: (body: { identifier: string; code: string; newPassword: string }) =>
    request<void>("/auth/reset-password", { method: "POST", body }),
  logout: () => request<void>("/auth/logout", { method: "POST" }),
  /** Login/registo com Google: `accessToken` vem do popup do Google; o servidor valida-o. */
  googleLogin: (body: { accessToken: string }) =>
    request<{ user: ApiUser }>("/auth/google", { method: "POST", body }),

  products: () => request<{ products: Array<{ id: string; name: string; description: string; price: number; category: string; image: string; stock: number; active: boolean }> }>("/products"),
  /**
   * Verifica stock/disponibilidade do carrinho ANTES de "Finalizar compra" (não cria nem reserva nada).
   * `status` por linha: ok | unavailable | out_of_stock | insufficient | over_limit; `available` = unidades que pode comprar.
   */
  validateCart: (items: Array<{ productId: string; quantity: number }>) =>
    request<CartCheck>("/orders/validate", { method: "POST", body: { items } }),
  /**
   * `idempotencyKey`: uuid gerado UMA vez por tentativa de compra. Duplo clique ou repetição por falha de rede
   * com a mesma chave devolvem o MESMO pedido em vez de criar outro.
   */
  createOrder: (body: { items: Array<{ productId: string; quantity: number }>; paymentMethod: string; shippingAddress: string; deliveryMethod: string; deliveryQuoteToken?: string; idempotencyKey: string }) =>
    request<{ order: { id: string; total: number; status: string; createdAt: string } }>("/orders", { method: "POST", body }),
};
