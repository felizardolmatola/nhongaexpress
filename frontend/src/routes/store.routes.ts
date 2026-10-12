/**
 * routes/store.routes.ts — rotas públicas da loja (montadas em /api pelo routes/index.ts).
 * (Os pedidos têm o seu próprio ficheiro: routes/orders.routes.ts.)
 *
 *   GET  /api/home      página inicial: destaque + vitrines (só produtos ativos)
 *   GET  /api/products  catálogo público de produtos
 */
import { Router } from "express";
import { homeController } from "../controllers/home.controller.js";
import { storeController } from "../controllers/store.controller.js";

export const storeRouter = Router();

storeRouter.get("/home", homeController.get);
storeRouter.get("/products", storeController.products);
