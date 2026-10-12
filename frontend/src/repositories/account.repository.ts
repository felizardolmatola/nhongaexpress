/**
 * repositories/account.repository.ts — acesso à base de dados para moradas e preferências.
 * Sem regras de negócio (limites, "padrão" automático...): isso está em services/account.service.ts.
 */
import { supabase } from "../config/supabase.js";
import { HttpError } from "../utils/httpError.js";
import { normalizePhone, DELIVERY_CITY, DELIVERY_PROVINCE, type AddressInput } from "../schemas/account.schema.js";

export type AddressView = {
  id: string;
  label: string;
  name: string;
  phone: string;
  province: string;
  city: string;
  neighborhood: string;
  reference: string;
  /** true = dentro da cidade da Beira (45 min); false = fora da cidade (1 hora e 30 minutos). */
  inCity: boolean;
  isDefault: boolean;
  createdAt: string;
};

export type SettingsView = { defaultPayment: string | null; notifyOrders: boolean; notifyOffers: boolean };

const COLUMNS = "id,label,recipient,phone,province,city,neighborhood,reference,in_city,is_default,created_at";

const toView = (r: any): AddressView => ({
  id: r.id,
  label: r.label,
  name: r.recipient,
  phone: r.phone,
  province: r.province,
  city: r.city,
  neighborhood: r.neighborhood,
  reference: r.reference ?? "",
  inCity: r.in_city ?? true,
  isDefault: Boolean(r.is_default),
  createdAt: r.created_at,
});

/** Campos editáveis de uma morada, já limpos (cidade e província vêm sempre do servidor). */
const toRow = (input: AddressInput) => ({
  label: input.label.trim(),
  recipient: input.name.trim(),
  phone: normalizePhone(input.phone),
  province: DELIVERY_PROVINCE,
  city: DELIVERY_CITY,
  in_city: true,
  neighborhood: input.neighborhood.trim(),
  reference: input.reference.trim(),
});

const fail = (error: { message: string }, message: string): never => {
  console.error("[db]", error.message);
  throw new HttpError(500, message);
};

export const accountRepository = {
  /** Moradas do cliente: a padrão primeiro, depois da mais antiga para a mais recente. */
  async listAddresses(userId: string): Promise<AddressView[]> {
    const { data, error } = await supabase
      .from("addresses")
      .select(COLUMNS)
      .eq("user_id", userId)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true });
    if (error) fail(error, "Não foi possível carregar as moradas.");
    return (data ?? []).map(toView);
  },

  async insertAddress(userId: string, input: AddressInput, isDefault: boolean): Promise<void> {
    const { error } = await supabase.from("addresses").insert({ user_id: userId, ...toRow(input), is_default: isDefault });
    if (error) fail(error, "Não foi possível guardar a morada.");
  },

  /** Devolve false se a morada não existe ou não é do cliente. */
  async updateAddress(userId: string, id: string, input: AddressInput): Promise<boolean> {
    const { data, error } = await supabase
      .from("addresses")
      .update({ ...toRow(input), updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", userId)
      .select("id");
    if (error) fail(error, "Não foi possível guardar a morada.");
    return (data ?? []).length > 0;
  },

  /** Troca a morada padrão numa única transação (função SQL `set_default_address`). */
  async setDefault(userId: string, id: string): Promise<void> {
    const { error } = await supabase.rpc("set_default_address", { p_user_id: userId, p_address_id: id });
    if (error) {
      if (error.message?.includes("ADDRESS_NOT_FOUND")) throw new HttpError(404, "Morada não encontrada.");
      fail(error, "Não foi possível definir a morada padrão.");
    }
  },

  async deleteAddress(userId: string, id: string): Promise<boolean> {
    const { data, error } = await supabase.from("addresses").delete().eq("id", id).eq("user_id", userId).select("id");
    if (error) fail(error, "Não foi possível eliminar a morada.");
    return (data ?? []).length > 0;
  },

  /** Preferências do cliente (valores por omissão se ainda não guardou nenhuma). */
  async getSettings(userId: string): Promise<SettingsView> {
    const { data, error } = await supabase
      .from("user_settings")
      .select("default_payment,notify_orders,notify_offers")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) fail(error, "Não foi possível carregar as definições.");
    return {
      defaultPayment: data?.default_payment ?? null,
      notifyOrders: data?.notify_orders ?? true,
      notifyOffers: data?.notify_offers ?? false,
    };
  },

  /** Grava só os campos enviados (os outros ficam como estão). */
  async saveSettings(userId: string, patch: { defaultPayment?: string | null; notifyOrders?: boolean; notifyOffers?: boolean }): Promise<void> {
    const row: Record<string, unknown> = { user_id: userId, updated_at: new Date().toISOString() };
    if (patch.defaultPayment !== undefined) row.default_payment = patch.defaultPayment;
    if (patch.notifyOrders !== undefined) row.notify_orders = patch.notifyOrders;
    if (patch.notifyOffers !== undefined) row.notify_offers = patch.notifyOffers;
    const { error } = await supabase.from("user_settings").upsert(row, { onConflict: "user_id" });
    if (error) fail(error, "Não foi possível guardar as definições.");
  },
};
