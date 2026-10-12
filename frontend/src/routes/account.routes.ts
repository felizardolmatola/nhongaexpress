/**
 * routes/account.routes.ts — moradas e definições da conta (montado em /api/account pelo routes/index.ts).
 * Todas exigem sessão iniciada; os dados são sempre os do próprio cliente.
 *
 *   GET    /api/account/addresses              lista as moradas guardadas
 *   POST   /api/account/addresses              guarda uma morada nova (máx. 5)
 *   PUT    /api/account/addresses/:id          edita uma morada
 *   POST   /api/account/addresses/:id/default  define a morada padrão
 *   DELETE /api/account/addresses/:id          elimina uma morada
 *   GET    /api/account/settings               preferências (pagamento padrão, notificações)
 *   PATCH  /api/account/settings               altera só as preferências enviadas
 */
import { Router } from "express";
import { accountController } from "../controllers/account.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { addressSchema, settingsPatchSchema } from "../schemas/account.schema.js";

export const accountRouter = Router();

accountRouter.use(requireAuth);

accountRouter.get("/addresses", accountController.listAddresses);
accountRouter.post("/addresses", validateBody(addressSchema), accountController.createAddress);
accountRouter.put("/addresses/:id", validateBody(addressSchema), accountController.updateAddress);
accountRouter.post("/addresses/:id/default", accountController.setDefaultAddress);
accountRouter.delete("/addresses/:id", accountController.deleteAddress);

accountRouter.get("/settings", accountController.getSettings);
accountRouter.patch("/settings", validateBody(settingsPatchSchema), accountController.updateSettings);
