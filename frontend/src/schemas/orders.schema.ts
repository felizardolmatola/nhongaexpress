/**
 * schemas/orders.schema.ts — contrato do corpo de POST /api/orders (validado com zod).
 *
 * O cliente NUNCA envia preços nem totais: só diz QUE produtos quer e em que
 * quantidade. Preço, stock e total são sempre lidos/calculados no servidor.
 * Campos desconhecidos são descartados (zod remove-os por omissão).
 */
import { z } from "zod";

// Têm de coincidir com os `value` de PAYMENT_OPTIONS / DELIVERY_OPTIONS no frontend (App.tsx).
export const PAYMENT_METHODS = ["M-Pesa", "e-Mola", "Pagamento na entrega"] as const;
// Só entregamos dentro da cidade da Beira: Expresso (45 min).
// "Fora da cidade" foi retirada até existir uma tabela de preços para fora da Beira (sem ela a taxa seria 0).
// Para a reactivar: acrescente aqui a modalidade, dê-lhe preço em feeForOrder() e remova o trigger de orders-block-out-of-city.sql.
export const DELIVERY_METHODS = ["Expresso (45 minutos)"] as const;

export const MAX_QTY_PER_PRODUCT = 99;

export const createOrderSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().uuid("Produto inválido."),
        quantity: z.coerce
          .number()
          .int("Quantidade inválida.")
          .min(1, "A quantidade mínima é 1.")
          .max(MAX_QTY_PER_PRODUCT, `A quantidade máxima por produto é ${MAX_QTY_PER_PRODUCT}.`),
      }),
    )
    .min(1, "O carrinho está vazio.")
    .max(50, "Demasiados produtos num só pedido."),
  paymentMethod: z.enum(PAYMENT_METHODS, { message: "Forma de pagamento inválida." }),
  deliveryMethod: z.enum(DELIVERY_METHODS, { message: "Modalidade de entrega inválida. De momento só entregamos dentro da cidade da Beira." }),
  shippingAddress: z.string().trim().min(3, "Indique a morada de entrega.").max(500, "Morada demasiado longa."),
  /**
   * Cotação de entrega (GPS ou bairro) assinada pelo servidor em POST /api/delivery/quote.
   * O custo de entrega sai SEMPRE deste token, nunca de um número enviado pelo cliente.
   */
  deliveryQuoteToken: z.string().trim().max(2000).optional(),
  /**
   * Chave gerada pelo frontend (uuid) por tentativa de compra. Se o cliente clicar duas vezes
   * ou repetir o pedido por falha de rede, o servidor devolve o MESMO pedido em vez de criar outro.
   */
  idempotencyKey: z.string().uuid().optional(),
});

/** Corpo de POST /api/orders/validate: só os itens (verificação de stock antes de "Finalizar compra"). */
export const validateCartSchema = createOrderSchema.pick({ items: true });

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type ValidateCartInput = z.infer<typeof validateCartSchema>;
