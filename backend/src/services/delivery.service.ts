/**
 * services/delivery.service.ts — taxa de entrega FIXA por bairro (cidade da Beira).
 *
 * Sem GPS e sem cálculo de distância: cada bairro tem um preço em MT na tabela delivery_zones (coluna fee_mzn),
 * que o administrador pode alterar no painel. O cliente escolhe o bairro, o servidor devolve a taxa e um
 * `quoteToken` ASSINADO. O checkout envia esse token em POST /api/orders e é daí que sai o custo de entrega:
 * o cliente nunca consegue enviar um valor seu.
 */
import jwt, { type SignOptions } from "jsonwebtoken";
import { supabase } from "../config/supabase.js";
import { env } from "../config/env.js";
import { HttpError } from "../utils/httpError.js";
import { BEIRA_NEIGHBORHOODS } from "../schemas/account.schema.js";
import { DELIVERY_METHODS } from "../schemas/orders.schema.js";

const QUOTE_ISSUER = "nhongaexpress-api";
const QUOTE_AUDIENCE = "nhongaexpress-delivery-quote"; // diferente da sessão: um token de sessão nunca serve como cotação
const QUOTE_TTL = "60m";
const IN_CITY_METHOD = DELIVERY_METHODS[0];
const MAX_FEE_MZN = 100000;

export type DeliveryQuoteResult = {
  city: "Beira";
  neighborhood: string;
  priceMzn: number;
  currency: "MZN";
  quoteToken: string;
};

type QuotePayload = { fee?: unknown; z?: unknown };

export const validCoord = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v); // usado também pela localização do entregador
const validFee = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= MAX_FEE_MZN;
export const isNeighborhood = (v: unknown): v is (typeof BEIRA_NEIGHBORHOODS)[number] =>
  typeof v === "string" && (BEIRA_NEIGHBORHOODS as readonly string[]).includes(v);
/** Minúsculas e sem acentos, para comparar "Ponta-Gêa" com "ponta-gea". */
const plain = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

export const deliveryService = {
  /** Cotação: taxa fixa do bairro escolhido, com token assinado (60 min). */
  async quoteForNeighborhood(neighborhood: unknown): Promise<DeliveryQuoteResult> {
    if (!isNeighborhood(neighborhood)) throw new HttpError(400, "Selecione um bairro da cidade da Beira.");
    const { data, error } = await supabase.from("delivery_zones").select("fee_mzn").eq("neighborhood", neighborhood).maybeSingle();
    if (error) throw new HttpError(500, "Não foi possível obter a taxa de entrega. Execute a migração SQL delivery-zones.sql.");
    if (!data || !validFee(data.fee_mzn)) throw new HttpError(422, "Ainda não há taxa de entrega definida para este bairro. Contacte-nos.");
    const quoteToken = jwt.sign({ fee: data.fee_mzn, z: neighborhood }, env.JWT_SECRET, {
      algorithm: "HS256",
      issuer: QUOTE_ISSUER,
      audience: QUOTE_AUDIENCE,
      expiresIn: QUOTE_TTL as SignOptions["expiresIn"],
    });
    return { city: "Beira", neighborhood, priceMzn: data.fee_mzn, currency: "MZN", quoteToken };
  },

  /** Todos os bairros com a taxa (null = ainda sem taxa definida). */
  async listZones(): Promise<Array<{ neighborhood: string; feeMzn: number | null }>> {
    const { data, error } = await supabase.from("delivery_zones").select("neighborhood,fee_mzn");
    if (error) throw new HttpError(500, "Não foi possível carregar os bairros. Execute a migração SQL delivery-zones.sql.");
    type ZoneRow = { neighborhood: string; fee_mzn: unknown };
    const byName = new Map<string, ZoneRow>(((data ?? []) as ZoneRow[]).map((z) => [z.neighborhood, z]));
    return BEIRA_NEIGHBORHOODS.map((n) => {
      const fee = byName.get(n)?.fee_mzn;
      return { neighborhood: n, feeMzn: validFee(fee) ? fee : null };
    });
  },

  /** Define a taxa fixa (em MT) de um bairro. */
  async saveZoneFee(neighborhood: unknown, feeMzn: unknown): Promise<void> {
    if (!isNeighborhood(neighborhood)) throw new HttpError(400, "Bairro inválido.");
    if (!validFee(feeMzn)) throw new HttpError(400, `Indique a taxa em MT (número inteiro entre 0 e ${MAX_FEE_MZN}).`);
    const { error } = await supabase.from("delivery_zones").upsert(
      { neighborhood, fee_mzn: feeMzn, updated_at: new Date().toISOString() },
      { onConflict: "neighborhood" },
    );
    if (error) {
      console.error("[delivery zones]", error.message);
      throw new HttpError(500, "Não foi possível guardar a taxa. Execute a migração SQL delivery-zones.sql.");
    }
  },

  /**
   * Custo de entrega de um pedido, SEMPRE lido do token assinado pelo servidor (nunca de um número do cliente).
   * A cotação é obrigatória e só existe a modalidade dentro da cidade (Expresso).
   */
  feeForOrder(deliveryMethod: string, quoteToken: string | undefined, shippingAddress: string): number {
    if (deliveryMethod !== IN_CITY_METHOD) throw new HttpError(400, "De momento só entregamos dentro da cidade da Beira.");
    if (!quoteToken) throw new HttpError(400, "Calcule a taxa de entrega (escolha o bairro) antes de finalizar o pedido.");
    let payload: QuotePayload;
    try {
      payload = jwt.verify(quoteToken, env.JWT_SECRET, { algorithms: ["HS256"], issuer: QUOTE_ISSUER, audience: QUOTE_AUDIENCE }) as unknown as QuotePayload;
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) throw new HttpError(410, "O cálculo da entrega expirou. Calcule novamente.");
      throw new HttpError(400, "Cálculo de entrega inválido. Calcule novamente.");
    }
    if (!validFee(payload.fee)) throw new HttpError(400, "Cálculo de entrega inválido. Calcule novamente.");
    // O bairro da cotação tem de ser o da morada do pedido (tokens antigos, sem bairro ou com outro formato, são recusados).
    if (typeof payload.z !== "string" || !plain(shippingAddress).includes(plain(payload.z))) {
      throw new HttpError(400, "O bairro do cálculo de entrega não corresponde à morada. Calcule a entrega novamente.");
    }
    return payload.fee;
  },
};
