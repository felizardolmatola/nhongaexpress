/**
 * routes/categories.routes.ts — categorias públicas (montado em /api/categories pelo routes/index.ts).
 *
 *   GET /api/categories   lista de categorias (nome + ícone), por ordem
 */
import { Router } from "express";
import { categoriesController } from "../controllers/categories.controller.js";

export const categoriesRouter = Router();

categoriesRouter.get("/", categoriesController.list);
