/**
 * schemas/account.schema.ts — contrato dos corpos de /api/account/* (validado com zod).
 *
 * Moradas: o cliente só envia os campos que escreve; cidade e província são sempre as da
 * entrega (Cidade da Beira, Sofala) e definidas no servidor. Bairro e referência são obrigatórios.
 */
import { z } from "zod";
import { PAYMENT_METHODS } from "./orders.schema.js";

export const DELIVERY_CITY = "Cidade da Beira";
export const DELIVERY_PROVINCE = "Sofala";
/** Nome da "cidade" das moradas fora da cidade da Beira (entrega em 1 hora e 30 minutos). */
export const OUTSIDE_CITY = "Fora da cidade";
export const MAX_ADDRESSES = 5;

// Os mesmos 26 bairros de BEIRA_ZONES no frontend (App.tsx).
export const BEIRA_NEIGHBORHOODS = [
  "Chaimite", "Chipangara", "Esturro", "Macurungo", "Macuti", "Matacuane", "Pioneiros", "Ponta-Gêa",
  "Chota", "Mananga", "Maraza", "Munhava-Central", "Vaz",
  "Alto da Manga", "Chingussura", "Inhamízua", "Matadouro", "Nhaconjo", "Vila Massane",
  "Manga Mascarenhas", "Muave", "Mungassa", "Ndunda",
  "Nhangau", "Nhangoma", "Tchonja",
] as const;

// Telemóvel moçambicano: 82–87 + 7 dígitos, com ou sem +258. Guardamos só os 9 dígitos.
const MZ_PHONE = /^(?:\+?258)?(8[2-7]\d{7})$/;

const addressBase = z.object({
  label: z.string().trim().min(1, "Dê um nome à morada (ex.: Casa).").max(30, "Nome demasiado longo (máx. 30)."),
  name: z.string().trim().min(3, "Indique o nome completo de quem recebe.").max(80, "Nome demasiado longo."),
  phone: z.string().trim().refine((v) => MZ_PHONE.test(v.replace(/[\s-]/g, "")), "Indique um número válido (ex.: 84 123 4567)."),
  /** Entregas limitadas à cidade da Beira. */
  inCity: z.boolean().optional(),
  neighborhood: z.string().trim().min(1, "Selecione o bairro.").max(60, "Texto demasiado longo."),
  reference: z.string().trim().min(3, "Indique um ponto de referência obrigatório.").max(120, "Texto demasiado longo."),
  /** Só na criação/edição: pede para esta morada ficar como padrão. */
  makeDefault: z.boolean().optional(),
});
export const addressSchema = addressBase.superRefine((v, ctx) => {
  if (!(BEIRA_NEIGHBORHOODS as readonly string[]).includes(v.neighborhood)) {
    ctx.addIssue({ code: "custom", path: ["neighborhood"], message: "Selecione um bairro da cidade da Beira." });
  }
});
export type AddressInput = z.infer<typeof addressBase>;

/** "+258 84 123 4567" / "841234567" -> "841234567". */
export const normalizePhone = (v: string): string => v.replace(/[\s-]/g, "").replace(/^\+?258/, "");

export const settingsPatchSchema = z
  .object({
    defaultPayment: z.enum(PAYMENT_METHODS, { message: "Forma de pagamento inválida." }).nullable().optional(),
    notifyOrders: z.boolean().optional(),
    notifyOffers: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "Nada para atualizar.");
export type SettingsPatch = z.infer<typeof settingsPatchSchema>;
