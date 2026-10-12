/**
 * repositories/orders.repository.ts — acesso à base de dados para pedidos.
 * Aqui não há regras de negócio: só leitura de produtos e a chamada à função SQL
 * `create_order`, que cria pedido + itens + baixa de stock numa ÚNICA transação.
 */
import { supabase } from "../config/supabase.js";
import { HttpError } from "../utils/httpError.js";

export type OrderItemView = {
  id: string;
  productId: string | null;
  name: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
};

/** O que o cliente pode ver do entregador do seu pedido: só o necessário para o receber (nunca o id nem dados internos). */
export type OrderDriverView = { name: string; phone: string; vehicle: string };

export type OrderView = {
  id: string;
  status: string;
  total: number;
  deliveryFee: number;
  paymentMethod: string;
  shippingAddress: string;
  deliveryMethod: string;
  createdAt: string;
  items: OrderItemView[];
  /** Entregador atribuído; null enquanto não há, e também depois de o pedido terminar (entregue/cancelado). */
  driver: OrderDriverView | null;
};

export type CheckoutProduct = { id: string; name: string; price: number; stock: number; active: boolean };

export type CreateOrderRow = {
  items: Array<{ productId: string; quantity: number }>;
  paymentMethod: string;
  shippingAddress: string;
  deliveryMethod: string;
  /** Custo de entrega já validado pelo servidor (token de cotação), nunca um valor do cliente. */
  deliveryFee: number;
  idempotencyKey?: string;
  /** Impressão digital do pedido (calculada no serviço): deteta pedidos idênticos repetidos. */
  requestHash?: string;
};

/** Estados em que o pedido já terminou e o cliente o pode eliminar do seu histórico. */
const FINISHED_STATUSES = ["cancelled", "completed"];
/** O cliente só vê o entregador enquanto o pedido está por entregar. */
const hasVisibleDriver = (status: string) => !FINISHED_STATUSES.includes(status);

export const ordersRepository = {
  /** Lê o estado ATUAL (preço, stock, ativo) dos produtos pedidos. */
  async findProducts(ids: string[]): Promise<CheckoutProduct[]> {
    const { data, error } = await supabase.from("products").select("id,name,price,stock,active").in("id", ids);
    if (error) {
      console.error("[db]", error.message);
      throw new HttpError(500, "Não foi possível verificar os produtos.");
    }
    return (data ?? []).map((r: any) => ({
      id: r.id,
      name: r.name,
      price: Number(r.price),
      stock: Number(r.stock),
      active: Boolean(r.active),
    }));
  },

  /**
   * Pedidos do cliente (mais recentes primeiro, máx. 50), cada um com os seus itens.
   * Se `orderId` for indicado, devolve só esse pedido (e só se pertencer ao cliente).
   * Pedidos que o cliente "eliminou" (hidden_by_customer = true) NÃO aparecem aqui, mas continuam na base de dados
   * e no painel administrativo (que não filtra por esta coluna).
   * Duas consultas simples (pedidos + itens) em vez de um join: não depende de relações configuradas no Supabase.
   */
  async listByUser(userId: string, orderId?: string): Promise<OrderView[]> {
    let query = supabase
      .from("orders")
      .select("id,status,total,delivery_fee,payment_method,shipping_address,delivery_method,created_at,driver_id")
      .eq("user_id", userId)
      .eq("hidden_by_customer", false);
    if (orderId) query = query.eq("id", orderId);
    const { data: orders, error } = await query.order("created_at", { ascending: false }).limit(50);
    if (error) {
      console.error("[db]", error.message);
      throw new HttpError(500, "Não foi possível carregar os seus pedidos.");
    }
    const rows = orders ?? [];
    if (rows.length === 0) return [];

    const { data: items, error: itemsError } = await supabase
      .from("order_items")
      .select("id,order_id,product_id,product_name,quantity,unit_price")
      .in("order_id", rows.map((o: any) => o.id));
    if (itemsError) {
      console.error("[db]", itemsError.message);
      throw new HttpError(500, "Não foi possível carregar os seus pedidos.");
    }

    // Entregadores dos pedidos em curso (uma só consulta, só as colunas que o cliente pode ver).
    const driverIds = [...new Set(rows.filter((o: any) => o.driver_id && hasVisibleDriver(o.status)).map((o: any) => o.driver_id as string))];
    const driversById = new Map<string, OrderDriverView>();
    if (driverIds.length > 0) {
      const { data: drivers, error: driversError } = await supabase.from("drivers").select("id,name,phone,vehicle").in("id", driverIds);
      if (driversError) console.error("[db]", driversError.message); // sem entregador o pedido continua a abrir
      for (const d of (drivers ?? []) as any[]) driversById.set(d.id, { name: d.name, phone: d.phone, vehicle: d.vehicle ?? "" });
    }

    // Agrupa os itens por pedido.
    const byOrder = new Map<string, OrderItemView[]>();
    for (const i of (items ?? []) as any[]) {
      const list = byOrder.get(i.order_id) ?? [];
      list.push({
        id: i.id,
        productId: i.product_id,
        name: i.product_name,
        quantity: Number(i.quantity),
        unitPrice: Number(i.unit_price),
        subtotal: Number(i.quantity) * Number(i.unit_price),
      });
      byOrder.set(i.order_id, list);
    }

    return rows.map((o: any) => ({
      id: o.id,
      status: o.status,
      total: Number(o.total),
      deliveryFee: Number(o.delivery_fee ?? 0),
      paymentMethod: o.payment_method,
      shippingAddress: o.shipping_address,
      deliveryMethod: o.delivery_method,
      createdAt: o.created_at,
      items: (byOrder.get(o.id) ?? []).sort((a, b) => a.name.localeCompare(b.name)),
      driver: o.driver_id && hasVisibleDriver(o.status) ? driversById.get(o.driver_id) ?? null : null,
    }));
  },

  /**
   * Cancela o pedido SÓ se ainda estiver "pending" e for do cliente (a condição vai na própria atualização,
   * por isso não há corrida com o administrador). O trigger `orders_restock_on_cancel` devolve o stock.
   * Devolve true se o pedido foi cancelado agora.
   */
  async cancel(userId: string, orderId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from("orders")
      .update({ status: "cancelled" })
      .eq("id", orderId)
      .eq("user_id", userId)
      .eq("status", "pending")
      .select("id");
    if (error) {
      console.error("[db]", error.message);
      throw new HttpError(500, "Não foi possível cancelar o pedido.");
    }
    return (data ?? []).length > 0;
  },

  /**
   * "Elimina" um pedido TERMINADO do histórico do cliente (cancelado ou entregue).
   * É uma eliminação LÓGICA: o pedido só fica marcado como escondido para o cliente (hidden_by_customer = true).
   * Nada é apagado — o pedido e os itens continuam na base de dados e no painel administrativo,
   * por isso o histórico, as vendas e o stock do administrador não são afetados.
   * Pedidos ainda em curso (a preparar, pagos, em processamento, enviados) nunca são escondidos por aqui.
   * Devolve true se o pedido foi escondido agora.
   */
  async removeFinished(userId: string, orderId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from("orders")
      .update({ hidden_by_customer: true })
      .eq("id", orderId)
      .eq("user_id", userId)
      .eq("hidden_by_customer", false)
      .in("status", FINISHED_STATUSES)
      .select("id");
    if (error) {
      console.error("[db]", error.message);
      throw new HttpError(500, "Não foi possível eliminar o pedido.");
    }
    return (data ?? []).length > 0;
  },

  /** Cria o pedido de forma atómica (tudo ou nada). Ver src/database/orders-checkout.sql e orders-duplicate-guard.sql. */
  async create(userId: string, input: CreateOrderRow): Promise<OrderView> {
    const { data, error } = await supabase.rpc("create_order", {
      p_user_id: userId,
      p_items: input.items,
      p_payment_method: input.paymentMethod,
      p_shipping_address: input.shippingAddress,
      p_delivery_method: input.deliveryMethod,
      p_delivery_fee: input.deliveryFee,
      p_idempotency_key: input.idempotencyKey ?? null,
      p_request_hash: input.requestHash ?? null,
    });
    if (error) {
      const msg = error.message ?? "";
      console.error("[db]", msg);
      const refId = msg.match(/:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i)?.[1]; // id anexado à exceção SQL
      // Corrida: outro cliente comprou o último item entre a nossa verificação e a transação.
      if (msg.includes("STOCK_INSUFFICIENT")) throw new HttpError(409, "Um ou mais produtos ficaram sem stock suficiente. Atualize o carrinho.", refId ? { [refId]: "Sem stock suficiente." } : undefined);
      if (msg.includes("PRODUCT_NOT_FOUND")) throw new HttpError(409, "Um produto do carrinho já não está disponível.", refId ? { [refId]: "Já não está disponível." } : undefined);
      // Pedido idêntico criado há instantes (outro clique, outro separador, outro dispositivo).
      if (msg.includes("DUPLICATE_ORDER")) throw new HttpError(409, "Já existe um pedido idêntico feito há instantes. Consulte «Os meus pedidos» antes de repetir.", refId ? { orderId: refId } : undefined);
      // A mesma tentativa de compra (chave) não pode servir para um pedido diferente.
      if (msg.includes("IDEMPOTENCY_KEY_REUSED")) throw new HttpError(409, "Esta tentativa de compra já foi utilizada. Reveja o pedido e tente novamente.");
      if (msg.includes("INVALID_QUANTITY")) throw new HttpError(409, "Quantidade inválida num dos produtos.", refId ? { [refId]: "Quantidade inválida." } : undefined);
      if (msg.includes("USER_NOT_FOUND")) throw new HttpError(401, "Sessão inválida. Inicie sessão novamente.");
      if (msg.includes("DELIVERY_METHOD_NOT_ALLOWED")) throw new HttpError(400, "De momento só entregamos dentro da cidade da Beira.");
      if (msg.includes("EMPTY_ORDER")) throw new HttpError(400, "O carrinho está vazio.");
      throw new HttpError(500, "Não foi possível criar o pedido.");
    }
    const o = data as any;
    return {
      id: o.id,
      status: o.status,
      total: Number(o.total),
      deliveryFee: Number(o.deliveryFee ?? 0),
      paymentMethod: o.paymentMethod,
      shippingAddress: o.shippingAddress,
      deliveryMethod: o.deliveryMethod,
      createdAt: o.createdAt,
      items: (o.items ?? []).map((i: any) => ({
        id: i.id,
        productId: i.productId,
        name: i.name,
        quantity: Number(i.quantity),
        unitPrice: Number(i.unitPrice),
        subtotal: Number(i.subtotal),
      })),
      driver: null, // pedido acabado de criar: o administrador ainda não atribuiu entregador
    };
  },
};
