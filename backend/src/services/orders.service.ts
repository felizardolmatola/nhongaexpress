/**
 * services/orders.service.ts — regras de negócio do checkout.
 *
 * Fluxo de POST /api/orders (a autenticação já foi feita pelo `requireAuth` na rota):
 *   1. juntar linhas repetidas do mesmo produto;
 *   2. calcular a impressão digital do pedido (`requestHash`) para detetar pedidos idênticos repetidos;
 *   3. criar pedido + itens, baixar o stock e calcular o total, tudo numa transação
 *      (função SQL `create_order`): serializa os checkouts do cliente, trata a idempotência e a janela
 *      anti-duplicado e confere existência/ativo/stock com os produtos BLOQUEADOS (fonte da verdade);
 *   4. se falhar por stock/disponibilidade, `checkCart` relê os produtos e devolve erro claro por produto;
 *   5. devolver o pedido criado, com os itens.
 *
 * ANTES do botão "Finalizar compra", o frontend chama POST /api/orders/validate (`validateCart`, a mesma
 * regra `checkLine`) para avisar o cliente cedo; é só um aviso — a garantia final é a transação.
 */
import { createHash } from "node:crypto";
import { HttpError } from "../utils/httpError.js";
import { ordersRepository, type CheckoutProduct, type OrderView } from "../repositories/orders.repository.js";
import { adminNotifications } from "./adminNotifications.service.js";
import { deliveryService } from "./delivery.service.js";
import { MAX_QTY_PER_PRODUCT, type CreateOrderInput, type ValidateCartInput } from "../schemas/orders.schema.js";

/** Resultado da verificação de uma linha do carrinho. */
export type CartLineStatus = "ok" | "unavailable" | "out_of_stock" | "insufficient" | "over_limit";
export type CartLineCheck = {
  productId: string;
  name: string | null;
  requested: number;
  /** Unidades que o cliente pode realmente comprar agora (0 se indisponível/esgotado). */
  available: number;
  unitPrice: number | null;
  status: CartLineStatus;
  message: string | null;
};
export type CartCheck = { ok: boolean; items: CartLineCheck[]; subtotal: number };

/** Junta linhas repetidas do mesmo produto: [{A,1},{A,2}] -> A: 3. */
const mergeItems = (items: Array<{ productId: string; quantity: number }>): Map<string, number> => {
  const wanted = new Map<string, number>();
  for (const { productId, quantity } of items) wanted.set(productId, (wanted.get(productId) ?? 0) + quantity);
  return wanted;
};

/**
 * Regra única de disponibilidade (usada na verificação prévia E no checkout):
 * o produto tem de existir e estar ativo, a quantidade não pode passar o máximo por pedido,
 * e tem de haver stock suficiente.
 */
const checkLine = (productId: string, requested: number, p: CheckoutProduct | undefined): CartLineCheck => {
  const base = { productId, requested, name: p?.name ?? null, unitPrice: p?.price ?? null };
  if (!p || !p.active) return { ...base, available: 0, status: "unavailable", message: "Um produto do carrinho já não está disponível." };
  if (p.stock <= 0) return { ...base, available: 0, status: "out_of_stock", message: `${p.name}: esgotado.` };
  if (requested > MAX_QTY_PER_PRODUCT) return { ...base, available: Math.min(p.stock, MAX_QTY_PER_PRODUCT), status: "over_limit", message: `${p.name}: máximo de ${MAX_QTY_PER_PRODUCT} unidades por pedido.` };
  if (p.stock < requested) return { ...base, available: p.stock, status: "insufficient", message: `${p.name}: só restam ${p.stock} unidade(s).` };
  return { ...base, available: Math.min(p.stock, MAX_QTY_PER_PRODUCT), status: "ok", message: null };
};

/** Lê o estado ATUAL dos produtos e confere cada linha do carrinho. */
const checkCart = async (wanted: Map<string, number>): Promise<CartCheck> => {
  const products = await ordersRepository.findProducts([...wanted.keys()]);
  const byId = new Map(products.map((p) => [p.id, p]));
  const items = [...wanted].map(([productId, quantity]) => checkLine(productId, quantity, byId.get(productId)));
  const subtotal = items.reduce((t, i) => (i.status === "ok" && i.unitPrice !== null ? t + i.unitPrice * i.requested : t), 0);
  return { ok: items.every((i) => i.status === "ok"), items, subtotal };
};

/** Falha com 409 e uma mensagem por produto (`fields` = { idDoProduto: mensagem }). */
const failIfProblems = (check: CartCheck): void => {
  const problems = check.items.filter((i) => i.status !== "ok");
  if (problems.length === 0) return;
  throw new HttpError(409, problems.map((i) => i.message).join(" "), Object.fromEntries(problems.map((i) => [i.productId, i.message ?? ""])));
};

/**
 * Impressão digital do pedido: mesmos itens + pagamento + entrega + morada + taxa => mesmo hash.
 * Serve para a base de dados recusar um pedido idêntico feito há instantes (ver orders-duplicate-guard.sql).
 */
const requestHashOf = (wanted: Map<string, number>, input: CreateOrderInput, deliveryFee: number): string => {
  const items = [...wanted].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const address = input.shippingAddress.trim().replace(/\s+/g, " ").toLowerCase();
  return createHash("sha256")
    .update(JSON.stringify({ items, pay: input.paymentMethod, del: input.deliveryMethod, address, fee: deliveryFee }))
    .digest("hex");
};

export const ordersService = {
  /**
   * Eliminação pelo próprio cliente: só pedidos já terminados (cancelados ou entregues).
   * O pedido apenas deixa de aparecer no histórico do cliente; o administrador continua a vê-lo.
   * Um pedido em curso tem de ser cancelado primeiro (ou concluído) — assim nunca se perde uma encomenda a caminho.
   */
  async removeMine(userId: string, orderId: string): Promise<void> {
    const [order] = await ordersRepository.listByUser(userId, orderId);
    if (!order) throw new HttpError(404, "Pedido não encontrado.");
    if (order.status !== "cancelled" && order.status !== "completed") {
      throw new HttpError(409, order.status === "pending"
        ? "Cancele o pedido antes de o eliminar."
        : "Este pedido ainda está em curso. Só pode eliminá-lo depois de entregue ou cancelado.");
    }
    if (!(await ordersRepository.removeFinished(userId, orderId))) throw new HttpError(404, "Pedido não encontrado.");
  },

  /**
   * Cancelamento pelo próprio cliente. Só é permitido enquanto o pedido está "pending"
   * (ainda a ser preparado); depois disso o cliente deve falar com o suporte.
   */
  async cancelMine(userId: string, orderId: string): Promise<OrderView> {
    const [order] = await ordersRepository.listByUser(userId, orderId);
    if (!order) throw new HttpError(404, "Pedido não encontrado.");
    if (order.status === "cancelled") return order; // já cancelado: resposta idempotente
    const blocked = new HttpError(409, "Este pedido já não pode ser cancelado online. Contacte o suporte.");
    if (order.status !== "pending") throw blocked;
    if (!(await ordersRepository.cancel(userId, orderId))) throw blocked; // mudou de estado entretanto
    const [updated] = await ordersRepository.listByUser(userId, orderId);
    // Avisa o administrador em segundo plano (não atrasa a resposta ao cliente).
    adminNotifications.orderCancelled(updated, userId);
    return updated;
  },

  /** Pedidos do próprio cliente (o `userId` vem da sessão, por isso ninguém vê pedidos de outros). */
  listMine(userId: string): Promise<OrderView[]> {
    return ordersRepository.listByUser(userId);
  },

  /**
   * Verificação PRÉVIA do carrinho (botão "Finalizar compra"): não cria nem reserva nada.
   * Devolve, por produto, se pode ser comprado e quantas unidades há. É só um aviso antecipado —
   * a garantia final continua a ser a transação do `placeOrder`, porque o stock pode mudar entretanto.
   */
  validateCart(input: ValidateCartInput["items"]): Promise<CartCheck> {
    return checkCart(mergeItems(input));
  },

  async placeOrder(userId: string, input: CreateOrderInput): Promise<OrderView> {
    // 0. Custo de entrega: lido do token assinado pelo servidor (GPS ou bairro); falha cedo se faltar ou tiver expirado.
    const deliveryFee = deliveryService.feeForOrder(input.deliveryMethod, input.deliveryQuoteToken, input.shippingAddress);

    // 1. Juntar duplicados: [{A,1},{A,2}] -> A: 3
    const wanted = mergeItems(input.items);

    // 2. Criação atómica (preços, stock e total são conferidos e calculados DENTRO da transação, com os produtos bloqueados).
    //    Não há pré-verificação de stock aqui de propósito: ela correria ANTES da idempotência da base de dados e,
    //    num duplo clique, o 2.º pedido veria o stock já baixado pelo 1.º e falharia com "esgotado" em vez de
    //    devolver o pedido original. A verificação prévia para o cliente é o `validateCart`, chamado pelo frontend.
    let order: OrderView;
    try {
      order = await ordersRepository.create(userId, {
        items: [...wanted].map(([productId, quantity]) => ({ productId, quantity })),
        paymentMethod: input.paymentMethod,
        shippingAddress: input.shippingAddress,
        deliveryMethod: input.deliveryMethod,
        deliveryFee,
        idempotencyKey: input.idempotencyKey,
        requestHash: requestHashOf(wanted, input, deliveryFee),
      });
    } catch (err) {
      // Falha de stock/disponibilidade: relê o estado atual para dizer ao cliente EXATAMENTE que produtos
      // falharam e quantas unidades restam (a transação só reporta o primeiro).
      if (err instanceof HttpError && err.status === 409 && err.fields && !("orderId" in err.fields)) failIfProblems(await checkCart(wanted));
      throw err;
    }

    // 4. Avisar o administrador por e-mail EM SEGUNDO PLANO: não é aguardado, por isso o cliente
    //    recebe a resposta do checkout sem esperar pelo servidor de e-mail (e uma falha de e-mail não afeta o pedido).
    adminNotifications.newOrder(order, userId);
    return order;
  },
};
