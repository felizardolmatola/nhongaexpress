import type { Request, Response } from "express";
import { publicProductsRepository } from "../repositories/products.public.repository.js";

export const storeController = {
  products: async (_req: Request, res: Response) => res.json({ products: await publicProductsRepository.list() }),
};
