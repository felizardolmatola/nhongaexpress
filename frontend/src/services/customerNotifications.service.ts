/**
 * services/customerNotifications.service.ts — e-mails enviados AO CLIENTE sobre o pedido:
 *   1. pedido criado (confirmação de compra)
 *   2. pedido cancelado (confirmação do cancelamento)
 *   3. pedido entregue
 *
 * REGRAS (iguais às do adminNotifications):
 * - Tudo corre em segundo plano (utils/jobQueue.ts): nunca atrasa nem faz falhar a resposta HTTP.
 * - Se o cliente não tiver e-mail (conta criada só com telefone), não se envia nada.
 * - Cada aviso é enviado uma só vez por pedido (por processo), mesmo que a ação seja repetida.
 */
import { env } from "../config/env.js";
import { usersRepository } from "../repositories/users.repository.js";
import type { OrderView } from "../repositories/orders.repository.js";
import { enqueue } from "../utils/jobQueue.js";
import { sendEmail } from "../utils/notifier.js";

const mt = (n: number) => `${n.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MT`;
const when = (iso?: string) =>
  new Date(iso ?? Date.now()).toLocaleString("pt-PT", { timeZone: "Africa/Maputo", dateStyle: "short", timeStyle: "short" });
const code = (order: OrderView) => `#${order.id.slice(0, 8).toUpperCase()}`;

const itemLines = (order: OrderView) =>
  order.items.map((i) => `  • ${i.quantity} × ${i.name} — ${mt(i.unitPrice)} (subtotal ${mt(i.subtotal)})`).join("\n");

/** Evita duplicados: "evento:pedido". Limitado para não crescer sem fim. */
const sent = new Set<string>();
const firstTime = (key: string): boolean => {
  if (sent.has(key)) return false;
  sent.add(key);
  if (sent.size > 10000) sent.delete(sent.values().next().value as string);
  return true;
};

/** Procura o cliente, monta o texto e envia. Sem e-mail na conta: não faz nada. */
const notifyCustomer = (
  event: "criado" | "cancelado" | "entregue",
  order: OrderView,
  customerId: string,
  build: (name: string) => { subject: string; lines: string[] },
): void => {
  if (!firstTime(`${event}:${order.id}`)) return;
  enqueue(`cliente-pedido-${event} ${order.id}`, async () => {
    const customer = await usersRepository.findById(customerId);
    if (!customer?.email) return;
    const { subject, lines } = build(customer.name);
    const text = [`Olá, ${customer.name}.`, "", ...lines, "", "Obrigado por comprar na NhongaExpress.", env.CLIENT_ORIGIN].join("\n");
    await sendEmail(customer.email, subject, text);
  });
};

export const customerNotifications = {
  /** Pedido acabou de ser criado. */
  orderPlaced(order: OrderView, customerId: string): void {
    notifyCustomer("criado", order, customerId, () => ({
      subject: `Recebemos o seu pedido ${code(order)}`,
      lines: [
        "Recebemos o seu pedido e já o estamos a preparar.",
        "",
        `Pedido:    ${code(order)}`,
        `Data:      ${when(order.createdAt)}`,
        `Total:     ${mt(order.total)}`,
        `Pagamento: ${order.paymentMethod}`,
        `Entrega:   ${order.deliveryMethod}`,
        `Morada:    ${order.shippingAddress}`,
        "",
        "Itens:",
        itemLines(order),
        "",
        "Enquanto o pedido estiver pendente, pode cancelá-lo na sua conta.",
      ],
    }));
  },

  /** O pedido acabou de ser cancelado. */
  orderCancelled(order: OrderView, customerId: string): void {
    notifyCustomer("cancelado", order, customerId, () => ({
      subject: `Pedido ${code(order)} cancelado`,
      lines: [
        "Confirmamos que o seu pedido foi cancelado.",
        "",
        `Pedido:    ${code(order)}`,
        `Cancelado: ${when()}`,
        `Total:     ${mt(order.total)}`,
        "",
        "Itens:",
        itemLines(order),
        "",
        "Se não foi você a cancelar, ou se tem dúvidas, contacte o nosso suporte.",
      ],
    }));
  },

  /** O pedido passou a "entregue" (status "completed"). */
  orderDelivered(order: OrderView, customerId: string): void {
    notifyCustomer("entregue", order, customerId, () => ({
      subject: `O seu pedido ${code(order)} foi entregue`,
      lines: [
        "O seu pedido foi entregue. Esperamos que goste!",
        "",
        `Pedido:    ${code(order)}`,
        `Entregue:  ${when()}`,
        `Total:     ${mt(order.total)}`,
        `Morada:    ${order.shippingAddress}`,
        "",
        "Itens:",
        itemLines(order),
        "",
        "Se algo não estiver como esperava, responda a este e-mail ou contacte o suporte.",
      ],
    }));
  },
};
