/**
 * routes/index.ts — agrupa TODAS as rotas da API sob o prefixo /api.
 * Para acrescentar um novo recurso (produtos, pedidos...), crie
 * `produtos.routes.ts` nesta pasta e registe-o aqui com `apiRouter.use(...)`.
 */
import { Router } from "express";
import { authRouter } from "./auth.routes.js";
import { adminRouter } from "./admin.routes.js";
import { storeRouter } from "./store.routes.js";
import { ordersRouter } from "./orders.routes.js";
import { accountRouter } from "./account.routes.js";
import { categoriesRouter } from "./categories.routes.js";
import { deliveryRouter } from "./delivery.routes.js";
import { sameOriginOnly } from "../middleware/adminAuth.js";

export const apiRouter = Router();

// Defesa extra contra CSRF em TODA a API: pedidos que alteram dados só vêm do nosso frontend (CLIENT_ORIGIN).
apiRouter.use(sameOriginOnly);
apiRouter.get("/health", (_req, res) => res.json({ status: "ok" }));
apiRouter.use("/auth", authRouter);
apiRouter.use("/admin", adminRouter);
apiRouter.use("/orders", ordersRouter);
apiRouter.use("/delivery", deliveryRouter);
apiRouter.use("/account", accountRouter);
apiRouter.use("/categories", categoriesRouter); // categorias e ícones geridos no painel (antes do storeRouter)
apiRouter.use("", storeRouter);
