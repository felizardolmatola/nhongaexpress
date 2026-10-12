/**
 * controllers/account.controller.ts — camada HTTP fina das moradas e definições da conta.
 * (Sessão: `requireAuth` na rota. Corpo: `validateBody` na rota. Regras: services/account.service.ts.)
 */
import type { Request, Response } from "express";
import { accountService } from "../services/account.service.js";
import { HttpError } from "../utils/httpError.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Lê o :id da rota e recusa o que não for um uuid (404, como se a morada não existisse). */
const addressId = (req: Request): string => {
  const id = String(req.params.id);
  if (!UUID_RE.test(id)) throw new HttpError(404, "Morada não encontrada.");
  return id;
};
/** As respostas são dados pessoais e mudam: nunca ficam em cache. */
const send = (res: Response, body: unknown, status = 200) => {
  res.setHeader("Cache-Control", "no-store");
  res.status(status).json(body);
};

export const accountController = {
  listAddresses: async (req: Request, res: Response) => send(res, { addresses: await accountService.listAddresses(req.userId!) }),
  createAddress: async (req: Request, res: Response) => send(res, { addresses: await accountService.createAddress(req.userId!, req.body) }, 201),
  updateAddress: async (req: Request, res: Response) => send(res, { addresses: await accountService.updateAddress(req.userId!, addressId(req), req.body) }),
  setDefaultAddress: async (req: Request, res: Response) => send(res, { addresses: await accountService.setDefault(req.userId!, addressId(req)) }),
  deleteAddress: async (req: Request, res: Response) => send(res, { addresses: await accountService.deleteAddress(req.userId!, addressId(req)) }),

  getSettings: async (req: Request, res: Response) => send(res, { settings: await accountService.getSettings(req.userId!) }),
  updateSettings: async (req: Request, res: Response) => send(res, { settings: await accountService.updateSettings(req.userId!, req.body) }),
};
