/**
 * routes/orders.routes.ts — pedidos (montado em /api/orders pelo routes/index.ts).
 *
 *   GET  /api/orders   lista os pedidos do cliente com o estado de cada um (exige sessão iniciada)
 *   DELETE /api/orders/:id   o cliente esconde do seu histórico um pedido já terminado (o painel admin não é afetado)
 *   POST /api/orders/:id/cancel   o cliente cancela o seu pedido (só se ainda estiver a ser preparado)
 *   POST /api/orders/validate   verifica stock/disponibilidade do carrinho antes de "Finalizar compra" (não cria nada)
 *   POST /api/orders   cria um pedido a partir do carrinho (exige sessão iniciada)
 *
 * Ordem dos middlewares: sessão -> limite por utilizador -> validação do corpo -> controller.
 */
import { Router } from "express";
import { ordersController } from "../controllers/orders.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { orderLimiter } from "../middleware/rateLimit.js";
import { ipRateLimit } from "../middleware/ipRateLimit.js";
import { validateBody } from "../middleware/validate.js";
import { createOrderSchema, validateCartSchema } from "../schemas/orders.schema.js";

export const ordersRouter = Router();

// O estado do pedido é lido de 20 em 20 s pelo frontend; o limitador geral da API (apiLimiter) já cobre este uso.
ordersRouter.get("/", requireAuth, ordersController.list);
// Verificação de stock: leitura apenas (o stock já é público em /api/products), por isso não exige sessão; limitada por IP.
const validateLimit = ipRateLimit({ windowMs: 5 * 60 * 1000, max: 60, message: "Demasiadas verificações seguidas. Aguarde um momento e tente novamente." });
ordersRouter.post("/validate", validateLimit, validateBody(validateCartSchema), ordersController.validate);
ordersRouter.post("/:id/cancel", requireAuth, ordersController.cancel);
ordersRouter.delete("/:id", requireAuth, ordersController.remove);
ordersRouter.post("/", requireAuth, orderLimiter, validateBody(createOrderSchema), ordersController.create);
