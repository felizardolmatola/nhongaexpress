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

/** Pedido devolvido por POST /api/orders (valores calculados no servidor). */
export type ApiOrderItem = { id: string; productId: string | null; name: string; quantity: number; unitPrice: number; subtotal: number };
/** Entregador atribuído ao pedido (só nome, telefone e veículo: nada além do que o cliente precisa para o receber). */
export type ApiOrderDriver = { name: string; phone: string; vehicle: string };
/** `driver` é null/ausente enquanto o administrador ainda não atribuiu um entregador ao pedido. */
export type ApiOrder = { id: string; status: string; total: number; deliveryFee: number; paymentMethod: string; shippingAddress: string; deliveryMethod: string; createdAt: string; items: ApiOrderItem[]; driver?: ApiOrderDriver | null };

/** Morada guardada na conta (cidade e província são sempre as da entrega). */
export type ApiAddress = { id: string; label: string; name: string; phone: string; province: string; city: string; neighborhood: string; street?: string; reference: string; inCity: boolean; isDefault: boolean; createdAt: string };
/** O que o cliente escreve ao guardar uma morada. `makeDefault` pede que fique como padrão. */
export type ApiAddressInput = { label: string; name: string; phone: string; inCity: boolean; neighborhood: string; reference: string; makeDefault?: boolean };
/** Preferências da conta: forma de pagamento padrão e avisos. */
export type ApiSettings = { defaultPayment: string | null; notifyOrders: boolean; notifyOffers: boolean };
/** Taxa de entrega fixa por bairro (Beira); valor em meticais (MZN). `quoteToken` é assinado pelo servidor e segue com o pedido: é dele que sai o custo de entrega. */
export type DeliveryQuote = { city: "Beira"; neighborhood: string; priceMzn: number; currency: "MZN"; quoteToken: string };
export type DeliveryLocation = { latitude: number; longitude: number; heading?: number | null; speed?: number | null; updated_at: string } | null;

/** Erro de API: `fields` traz a mensagem por campo (identifier, email, phone, password, name). */
export class ApiError extends Error {
  constructor(public status: number, message: string, public fields?: Record<string, string>) {
    super(message);
    // Garante que `e instanceof ApiError` funciona mesmo se o `target` do TypeScript for ES5.
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
    throw new ApiError(0, "Erro de ligação. Verifique a sua ligação à Internet e tente novamente.");
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
  /** Login/registo com Apple: `idToken` vem do popup da Apple; `name` só existe na 1.ª autorização. */
  appleLogin: (body: { idToken: string; name?: string }) =>
    request<{ user: ApiUser }>("/auth/apple", { method: "POST", body }),

  products: () => request<{ products: Array<{ id: string; name: string; description: string; price: number; category: string; image: string; images?: string[]; stock: number; active: boolean }> }>("/products"),
  /** Bairros com a taxa de entrega fixa (priceMzn = null se ainda não definida). */
  deliveryZones: () => request<{ zones: Array<{ neighborhood: string; available: boolean; priceMzn: number | null }> }>("/delivery/zones"),
  /** Taxa de entrega do bairro escolhido. */
  deliveryQuote: (body: { city: "Beira"; neighborhood: string }) => request<DeliveryQuote>("/delivery/quote", { method: "POST", body }).then((quote) => ({ quote })),
  deliveryLocation: (orderId: string) => request<{ location: DeliveryLocation }>(`/delivery/orders/${encodeURIComponent(orderId)}/location`),
  /** Pedidos do cliente com o estado atual (pending, paid, processing, shipped, completed, cancelled). */
  myOrders: () => request<{ orders: ApiOrder[] }>("/orders"),
  /** Elimina um pedido do cliente (só funciona se já estiver cancelado). */
  deleteOrder: (id: string) => request<void>(`/orders/${id}`, { method: "DELETE" }),
  /** Moradas guardadas (a padrão vem primeiro). Todas as operações devolvem a lista completa e atualizada. */
  addresses: () => request<{ addresses: ApiAddress[] }>("/account/addresses"),
  createAddress: (body: ApiAddressInput) => request<{ addresses: ApiAddress[] }>("/account/addresses", { method: "POST", body }),
  updateAddress: (id: string, body: ApiAddressInput) => request<{ addresses: ApiAddress[] }>(`/account/addresses/${id}`, { method: "PUT", body }),
  setDefaultAddress: (id: string) => request<{ addresses: ApiAddress[] }>(`/account/addresses/${id}/default`, { method: "POST" }),
  deleteAddress: (id: string) => request<{ addresses: ApiAddress[] }>(`/account/addresses/${id}`, { method: "DELETE" }),
  /** Preferências da conta; no PATCH só vão os campos que mudam. */
  settings: () => request<{ settings: ApiSettings }>("/account/settings"),
  updateSettings: (body: Partial<ApiSettings>) => request<{ settings: ApiSettings }>("/account/settings", { method: "PATCH", body }),
  /** Cancela um pedido do cliente (só funciona enquanto o estado é "pending"). */
  cancelOrder: (id: string) => request<{ order: ApiOrder }>(`/orders/${id}/cancel`, { method: "POST" }),
  /**
   * Verifica stock/disponibilidade do carrinho ANTES de "Finalizar compra" (não cria nem reserva nada).
   * `status` por linha: ok | unavailable | out_of_stock | insufficient | over_limit; `available` = unidades que pode comprar.
   */
  validateCart: (items: Array<{ productId: string; quantity: number }>) =>
    request<CartCheck>("/orders/validate", { method: "POST", body: { items } }),
  /** Cria o pedido a partir do carrinho. Só enviamos ids e quantidades: preço, stock e total são decididos no servidor. */
  createOrder: (body: { items: Array<{ productId: string; quantity: number }>; paymentMethod: string; shippingAddress: string; deliveryMethod: string; deliveryQuoteToken?: string; idempotencyKey?: string }) =>
    request<{ order: ApiOrder }>("/orders", { method: "POST", body }),
};
