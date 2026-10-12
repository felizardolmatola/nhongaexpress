import { Router } from "express";
import { deliveryController } from "../controllers/delivery.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/adminAuth.js";
import { ipRateLimit } from "../middleware/ipRateLimit.js";

export const deliveryRouter=Router();
// Limite por IP na cotação, para ninguém a usar em massa.
const quoteLimit=ipRateLimit({windowMs:10*60*1000,max:30,message:"Demasiados cálculos de entrega seguidos. Aguarde alguns minutos e tente novamente."});
deliveryRouter.post("/quote",quoteLimit,deliveryController.quote);
// Taxa fixa por bairro: lista pública com os preços; só o administrador os altera.
deliveryRouter.get("/zones",deliveryController.zones);
deliveryRouter.get("/zones/admin",requireAdmin,deliveryController.adminZones);
deliveryRouter.put("/zones/:neighborhood",requireAdmin,deliveryController.saveZone);
deliveryRouter.get("/orders/:id/location",requireAuth,deliveryController.location);
// Coordenadas do entregador são recebidas apenas por uma sessão administrativa autenticada.
// Para produção, recomenda-se substituir isto por autenticação específica do entregador.
deliveryRouter.put("/orders/:id/location",requireAdmin,(req,res,next)=>{req.body.orderId=req.params.id; next();},deliveryController.updateLocation);
