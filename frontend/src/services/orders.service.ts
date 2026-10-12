/**
 * services/orders.service.ts — regras de negócio do checkout.
 *
 * Fluxo de POST /api/orders (a autenticação já foi feita pelo `requireAuth` na rota):
 *   1. juntar linhas repetidas do mesmo produto;
 *   2. buscar os produtos na base de dados (preço e stock ATUAIS, nunca os do cliente);
 *   3. conferir que cada produto existe, está ativo e tem stock — erro claro por produto;
 *   4. criar pedido + itens, baixar o stock e calcular o total, tudo numa transação
 *      (função SQL `create_order`), que volta a conferir tudo com os produtos BLOQUEADOS,
 *      porque entre o passo 3 e o 4 outro cliente pode ter comprado o último item;
 *   5. devolver o pedido criado, com os itens.
 */
import { HttpError } from "../utils/httpError.js";
import { ordersRepository, type OrderView } from "../repositories/orders.repository.js";
import { adminNotifications } from "./adminNotifications.service.js";
import { customerNotifications } from "./customerNotifications.service.js";
import { MAX_QTY_PER_PRODUCT, type CreateOrderInput } from "../schemas/orders.schema.js";

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
    // Confirmação do cancelamento ao cliente, também em segundo plano.
    customerNotifications.orderCancelled(updated, userId);
    return updated;
  },

  /** Pedidos do próprio cliente (o `userId` vem da sessão, por isso ninguém vê pedidos de outros). */
  listMine(userId: string): Promise<OrderView[]> {
    return ordersRepository.listByUser(userId);
  },

  async placeOrder(userId: string, input: CreateOrderInput): Promise<OrderView> {
    // 1. Juntar duplicados: [{A,1},{A,2}] -> A: 3
    const wanted = new Map<string, number>();
    for (const { productId, quantity } of input.items) {
      wanted.set(productId, (wanted.get(productId) ?? 0) + quantity);
    }

    // 2. Estado atual dos produtos.
    const products = await ordersRepository.findProducts([...wanted.keys()]);
    const byId = new Map(products.map((p) => [p.id, p]));

    // 3. Conferir existência, ativo, quantidade e stock.
    const problems: Record<string, string> = {};
    for (const [productId, quantity] of wanted) {
      const p = byId.get(productId);
      if (!p || !p.active) problems[productId] = "Um produto do carrinho já não está disponível.";
      else if (quantity > MAX_QTY_PER_PRODUCT) problems[productId] = `${p.name}: máximo de ${MAX_QTY_PER_PRODUCT} unidades por pedido.`;
      else if (p.stock <= 0) problems[productId] = `${p.name}: esgotado.`;
      else if (p.stock < quantity) problems[productId] = `${p.name}: só restam ${p.stock} unidade(s).`;
    }
    if (Object.keys(problems).length > 0) {
      throw new HttpError(409, Object.values(problems).join(" "), problems);
    }

    // 4. Criação atómica (preços e total vêm da base de dados, dentro da transação).
    const order = await ordersRepository.create(userId, {
      items: [...wanted].map(([productId, quantity]) => ({ productId, quantity })),
      paymentMethod: input.paymentMethod,
      shippingAddress: input.shippingAddress,
      deliveryMethod: input.deliveryMethod,
      idempotencyKey: input.idempotencyKey,
    });

    // 5. Avisar o administrador por e-mail EM SEGUNDO PLANO: não é aguardado, por isso o cliente
    //    recebe a resposta do checkout sem esperar pelo servidor de e-mail (e uma falha de e-mail não afeta o pedido).
    adminNotifications.newOrder(order, userId);
    // Confirmação do pedido ao cliente (só envia se a conta tiver e-mail).
    customerNotifications.orderPlaced(order, userId);
    return order;
  },
};
