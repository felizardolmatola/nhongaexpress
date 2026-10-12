/**
 * controllers/categories.controller.ts — lista PÚBLICA das categorias (a loja usa-a para mostrar
 * as categorias e os ícones escolhidos no painel). A gestão (criar/editar/eliminar) está em admin.controller.ts.
 */
import type { Request, Response } from "express";
import { categoriesRepository } from "../repositories/categories.repository.js";

export const categoriesController = {
  /** GET /api/categories */
  list: async (_req: Request, res: Response) => {
    res.setHeader("Cache-Control", "no-cache"); // o administrador pode mudar a qualquer momento
    res.json({ categories: await categoriesRepository.list() });
  },
};
