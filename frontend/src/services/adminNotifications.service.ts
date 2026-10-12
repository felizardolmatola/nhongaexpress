/**
 * services/adminNotifications.service.ts — avisa o(s) administrador(es) por e-mail quando
 * há um novo pedido ou um novo utilizador registado.
 *
 * REGRAS:
 * - Tudo corre em segundo plano (ver utils/jobQueue.ts): estas funções devolvem na hora e
 *   NUNCA lançam erro, por isso nunca atrasam nem fazem falhar o checkout ou o registo.
 * - Destinatários: variável ADMIN_NOTIFY_EMAIL (vários separados por vírgula). Se estiver vazia,
 *   usa o e-mail de todas as contas com role = "admin".
 */
import { env } from "../config/env.js";
import { usersRepository, type PublicUser } from "../repositories/users.repository.js";
import type { OrderView } from "../repositories/orders.repository.js";
import { enqueue } from "../utils/jobQueue.js";
import { sendEmail } from "../utils/notifier.js";

const mt = (n: number) => `${n.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MT`;
const when = (iso?: string) =>
  new Date(iso ?? Date.now()).toLocaleString("pt-PT", { timeZone: "Africa/Maputo", dateStyle: "short", timeStyle: "short" });

/** Lista de destinatários, calculada no momento do envio (assim mudanças de admin valem logo). */
const recipients = async (): Promise<string[]> => {
  const fromEnv = (env.ADMIN_NOTIFY_EMAIL ?? "").split(",").map((e) => e.trim()).filter(Boolean);
  if (fromEnv.length > 0) return fromEnv;
  return usersRepository.listAdminEmails();
};

/** Envia a todos os destinatários; falhar para um não impede os outros (mas repete a tarefa se algum falhar). */
const sendToAdmins = async (subject: string, text: string): Promise<void> => {
  const to = await recipients();
  if (to.length === 0) {
    console.warn("[notify] sem destinatário: defina ADMIN_NOTIFY_EMAIL ou crie uma conta com role admin.");
    return;
  }
  const results = await Promise.allSettled(to.map((address) => sendEmail(address, subject, text)));
  const failed = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
  if (failed.length > 0) throw new Error(`${failed.length}/${to.length} envios falharam: ${String(failed[0].reason?.message ?? failed[0].reason)}`);
};

// Um pedido repetido (mesma idempotencyKey) devolve o mesmo pedido: avisa-se só uma vez por processo.
const notifiedOrders = new Set<string>();

const notifiedCancellations = new Set<string>();

export const adminNotifications = {
  /** Cliente cancelou o pedido (só chamado quando o cancelamento acabou de acontecer). */
  orderCancelled(order: OrderView, customerId: string): void {
    if (notifiedCancellations.has(order.id)) return;
    notifiedCancellations.add(order.id);
    if (notifiedCancellations.size > 5000) notifiedCancellations.delete(notifiedCancellations.values().next().value as string);

    enqueue(`pedido-cancelado ${order.id}`, async () => {
      const customer = await usersRepository.findById(customerId);
      const lines = order.items.map((i) => `  • ${i.quantity} × ${i.name} — ${mt(i.unitPrice)} (subtotal ${mt(i.subtotal)})`).join("\n");
      const text = [
        "Um cliente CANCELOU um pedido na NhongaExpress.",
        "",
        `Pedido:    #${order.id.slice(0, 8).toUpperCase()}`,
        `Feito em:  ${when(order.createdAt)}`,
        `Cancelado: ${when()}`,
        `Total:     ${mt(order.total)}`,
        "",
        "Cliente:",
        `  Nome:      ${customer?.name ?? "—"}`,
        `  E-mail:    ${customer?.email ?? "—"}`,
        `  Telefone:  ${customer?.phone ?? "—"}`,
        "",
        `Pagamento: ${order.paymentMethod}`,
        `Entrega:   ${order.deliveryMethod}`,
        `Morada:    ${order.shippingAddress}`,
        "",
        "Itens:",
        lines,
        "",
        "O stock dos produtos foi devolvido automaticamente.",
      ].join("\n");
      await sendToAdmins(`Pedido cancelado #${order.id.slice(0, 8).toUpperCase()} — ${mt(order.total)}`, text);
    });
  },

  newOrder(order: OrderView, customerId: string): void {
    if (notifiedOrders.has(order.id)) return;
    notifiedOrders.add(order.id);
    if (notifiedOrders.size > 5000) notifiedOrders.delete(notifiedOrders.values().next().value as string);

    enqueue(`novo-pedido ${order.id}`, async () => {
      const customer = await usersRepository.findById(customerId);
      const lines = order.items.map((i) => `  • ${i.quantity} × ${i.name} — ${mt(i.unitPrice)} (subtotal ${mt(i.subtotal)})`).join("\n");
      const text = [
        "Novo pedido na NhongaExpress!",
        "",
        `Pedido:    #${order.id.slice(0, 8).toUpperCase()}`,
        `Data:      ${when(order.createdAt)}`,
        `Total:     ${mt(order.total)}`,
        "",
        "Cliente:",
        `  Nome:      ${customer?.name ?? "—"}`,
        `  E-mail:    ${customer?.email ?? "—"}`,
        `  Telefone:  ${customer?.phone ?? "—"}`,
        "",
        `Pagamento: ${order.paymentMethod}`,
        `Entrega:   ${order.deliveryMethod}`,
        `Morada:    ${order.shippingAddress}`,
        "",
        "Itens:",
        lines,
        "",
        `Abra o painel administrativo (${env.CLIENT_ORIGIN}) para tratar este pedido.`,
      ].join("\n");
      await sendToAdmins(`Novo pedido #${order.id.slice(0, 8).toUpperCase()} — ${mt(order.total)}`, text);
    });
  },

  newUser(user: PublicUser, method: "e-mail e palavra-passe" | "Google"): void {
    enqueue(`novo-utilizador ${user.id}`, async () => {
      const text = [
        "Novo utilizador registado na NhongaExpress!",
        "",
        `Nome:      ${user.name}`,
        `E-mail:    ${user.email ?? "—"}`,
        `Telefone:  ${user.phone ?? "—"}`,
        `Registo:   ${method}`,
        `Data:      ${when(user.createdAt)}`,
      ].join("\n");
      await sendToAdmins(`Novo utilizador: ${user.name}`, text);
    });
  },
};
