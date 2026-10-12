/**
 * controllers/orders.controller.ts — camada HTTP fina: lê o pedido, chama o serviço, responde.
 * (A validação do corpo foi feita pelo `validateBody` na rota; o utilizador, pelo `requireAuth`.)
 */
import type { Request, Response } from "express";
import { ordersService } from "../services/orders.service.js";
import { HttpError } from "../utils/httpError.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const ordersController = {
  /** DELETE /api/orders/:id — o cliente tira um pedido já terminado (cancelado ou entregue) do seu histórico (o administrador continua a vê-lo). */
  remove: async (req: Request, res: Response) => {
    const id = String(req.params.id);
    if (!UUID_RE.test(id)) throw new HttpError(404, "Pedido não encontrado.");
    await ordersService.removeMine(req.userId!, id);
    res.status(204).end();
  },

  /** POST /api/orders/:id/cancel — o cliente cancela o seu pedido (só enquanto está a ser preparado). */
  cancel: async (req: Request, res: Response) => {
    const id = String(req.params.id);
    if (!UUID_RE.test(id)) throw new HttpError(404, "Pedido não encontrado.");
    const order = await ordersService.cancelMine(req.userId!, id);
    res.setHeader("Cache-Control", "no-store");
    res.json({ order });
  },

  /** GET /api/orders — lista os pedidos do cliente com o estado atual de cada um. */
  list: async (req: Request, res: Response) => {
    const orders = await ordersService.listMine(req.userId!);
    res.setHeader("Cache-Control", "no-store"); // o estado muda: nunca guardar em cache
    res.json({ orders });
  },

  /** POST /api/orders/validate — confere stock/disponibilidade do carrinho ANTES de "Finalizar compra" (não cria nada). */
  validate: async (req: Request, res: Response) => {
    const result = await ordersService.validateCart(req.body.items);
    res.setHeader("Cache-Control", "no-store");
    res.json(result);
  },

  create: async (req: Request, res: Response) => {
    const order = await ordersService.placeOrder(req.userId!, req.body);
    res.setHeader("Cache-Control", "no-store");
    res.status(201).json({ order });
  },
};
