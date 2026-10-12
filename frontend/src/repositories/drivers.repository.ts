/**
 * repositories/drivers.repository.ts — entregadores (cadastro feito no painel).
 *
 * Regras:
 * - O telefone é único (já vem normalizado como +258XXXXXXXXX).
 * - Um entregador com pedidos associados não se elimina (perder-se-ia o histórico das entregas):
 *   desativa-se. Inativos deixam de poder receber pedidos novos.
 */
import { supabase } from "../config/supabase.js";
import { HttpError } from "../utils/httpError.js";

export type DriverRow = { id: string; name: string; phone: string; vehicle: string; active: boolean; createdAt: string };
/** `activeOrders` = entregas em curso (pedidos ainda não entregues nem cancelados); `totalOrders` = todas as que já lhe foram atribuídas. */
export type DriverAdminRow = DriverRow & { activeOrders: number; totalOrders: number };

/** Estados em que o pedido ainda está por entregar. */
export const OPEN_ORDER_STATUSES = ["pending", "paid", "processing", "shipped"] as const;

const COLS = "id,name,phone,vehicle,active,created_at";
const toRow = (r: any): DriverRow => ({ id: r.id, name: r.name, phone: r.phone, vehicle: r.vehicle ?? "", active: Boolean(r.active), createdAt: r.created_at });
const isDuplicate = (e: any) => e?.code === "23505";
const DUPLICATE = "Já existe um entregador com esse telefone.";
const fail = (e: any, message: string): never => { console.error("[db]", e?.message); throw new HttpError(500, message); };

export const driversRepository = {
  /** Lista do painel: ativos primeiro, depois por nome; com o número de entregas de cada um. */
  async list(): Promise<DriverAdminRow[]> {
    const [drivers, orders] = await Promise.all([
      supabase.from("drivers").select(COLS).order("active", { ascending: false }).order("name", { ascending: true }),
      supabase.from("orders").select("driver_id,status").not("driver_id", "is", null),
    ]);
    if (drivers.error) fail(drivers.error, "Não foi possível carregar os entregadores.");
    if (orders.error) fail(orders.error, "Não foi possível carregar os entregadores.");

    const total = new Map<string, number>();
    const open = new Map<string, number>();
    for (const o of (orders.data ?? []) as any[]) {
      total.set(o.driver_id, (total.get(o.driver_id) ?? 0) + 1);
      if ((OPEN_ORDER_STATUSES as readonly string[]).includes(o.status)) open.set(o.driver_id, (open.get(o.driver_id) ?? 0) + 1);
    }
    return (drivers.data ?? []).map((r: any) => ({ ...toRow(r), activeOrders: open.get(r.id) ?? 0, totalOrders: total.get(r.id) ?? 0 }));
  },

  async get(id: string): Promise<DriverRow> {
    const { data, error } = await supabase.from("drivers").select(COLS).eq("id", id).maybeSingle();
    if (error) fail(error, "Não foi possível carregar o entregador.");
    if (!data) throw new HttpError(404, "Entregador não encontrado.");
    return toRow(data);
  },

  async create(input: { name: string; phone: string; vehicle: string }): Promise<DriverAdminRow> {
    const { data, error } = await supabase.from("drivers").insert({ name: input.name, phone: input.phone, vehicle: input.vehicle }).select(COLS).single();
    if (isDuplicate(error)) throw new HttpError(409, DUPLICATE);
    if (error) fail(error, "Não foi possível registar o entregador.");
    return { ...toRow(data), activeOrders: 0, totalOrders: 0 };
  },

  async update(id: string, patch: { name?: string; phone?: string; vehicle?: string; active?: boolean }): Promise<DriverRow> {
    await driversRepository.get(id); // 404 claro se não existir
    const change: Record<string, unknown> = {};
    if (patch.name !== undefined) change.name = patch.name;
    if (patch.phone !== undefined) change.phone = patch.phone;
    if (patch.vehicle !== undefined) change.vehicle = patch.vehicle;
    if (patch.active !== undefined) change.active = patch.active;
    const { data, error } = await supabase.from("drivers").update(change).eq("id", id).select(COLS).single();
    if (isDuplicate(error)) throw new HttpError(409, DUPLICATE);
    if (error) fail(error, "Não foi possível atualizar o entregador.");
    return toRow(data);
  },

  /** Só elimina quem nunca teve pedidos; os outros devem ser desativados. */
  async remove(id: string): Promise<void> {
    await driversRepository.get(id);
    const used = await supabase.from("orders").select("id", { count: "exact", head: true }).eq("driver_id", id);
    if (used.error) fail(used.error, "Não foi possível eliminar o entregador.");
    if ((used.count ?? 0) > 0) {
      throw new HttpError(409, "Este entregador tem pedidos associados. Desative-o em vez de o eliminar (o histórico das entregas fica guardado).");
    }
    const { error } = await supabase.from("drivers").delete().eq("id", id);
    if (error) fail(error, "Não foi possível eliminar o entregador.");
  },
};
