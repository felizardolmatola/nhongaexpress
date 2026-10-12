/**
 * routes/admin.routes.ts — API do painel (prefixo /api/admin).
 *
 * Fica separada da loja de propósito: tudo o que está aqui passa por `requireAdmin`
 * (sessão da loja + conta com role = 'admin'). Nenhuma rota pública da loja
 * (/api/auth, /api/products, /api/orders, /api/home) é alterada por este ficheiro.
 *
 *   GET    /api/admin/me                  quem é o administrador da sessão
 *   GET    /api/admin/dashboard           números e pedidos recentes
 *   GET    /api/admin/products            lista de produtos (também os inativos)
 *   POST   /api/admin/products            criar produto
 *   PATCH  /api/admin/products/:id        editar produto
 *   DELETE /api/admin/products/:id        eliminar produto
 *   GET    /api/admin/products/:id/home-sections   secções da página inicial em que o produto aparece
 *   PUT    /api/admin/products/:id/home-sections   definir as secções do produto (corpo: sections[])
 *   POST   /api/admin/uploads             enviar foto de produto ou ícone de categoria (corpo = ficheiro da imagem)
 *
 *   Secções da página inicial (slugs: featured | offers | new | best-sellers | recommended)
 *   GET    /api/admin/home-sections                              todas as secções com os seus produtos
 *   GET    /api/admin/home-sections/:slug                        uma secção
 *   PUT    /api/admin/home-sections/:slug/products               definir lista e ordem (corpo: productIds[])
 *   POST   /api/admin/home-sections/:slug/products               acrescentar produto (corpo: productId)
 *   DELETE /api/admin/home-sections/:slug/products/:productId    tirar produto da secção
 *
 *   GET    /api/admin/categories          categorias (nome, iconUrl, nº de produtos)
 *   POST   /api/admin/categories          criar categoria (corpo: name, iconUrl — URL devolvido por /uploads)
 *   PATCH  /api/admin/categories/:id      editar nome e/ou iconUrl (mudar o nome atualiza os produtos)
 *   DELETE /api/admin/categories/:id      eliminar (só se não tiver produtos)
 *
 *   GET    /api/admin/customers           clientes registados
 *   GET    /api/admin/drivers             entregadores (com entregas em curso e totais)
 *   POST   /api/admin/drivers             registar entregador (corpo: name, phone, vehicle?)
 *   PATCH  /api/admin/drivers/:id         editar / ativar / desativar (corpo: name?, phone?, vehicle?, active?)
 *   DELETE /api/admin/drivers/:id         eliminar (só se nunca teve pedidos; senão, desativar)
 *
 *   GET    /api/admin/orders              pedidos (com o entregador de cada um)
 *   PATCH  /api/admin/orders/:id/status   mudar o estado do pedido
 *   DELETE /api/admin/orders/:id          eliminar um pedido
 *   PUT    /api/admin/orders/:id/driver   atribuir (ou retirar, com driverId = null) o entregador do pedido
 *   GET    /api/admin/orders/:id/events   linha do tempo do pedido (estados e entregador)
 *   POST   /api/admin/orders/bulk-status  mudar o estado de vários pedidos (corpo: ids[], status)
 *   POST   /api/admin/orders/bulk-delete  eliminar vários pedidos (corpo: ids[])
 */
import express, { Router } from "express";
import { adminController } from "../controllers/admin.controller.js";
import { adminHomeController } from "../controllers/home.controller.js";
import { requireAdmin, sameOriginOnly } from "../middleware/adminAuth.js";
import { IMAGE_MIME_TYPES } from "../utils/image.js";

export const adminRouter = Router();

// Dados privados: nunca ficam em cache do navegador nem de proxies.
adminRouter.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});
adminRouter.use(sameOriginOnly);
adminRouter.use(requireAdmin);

adminRouter.get("/me", adminController.me);
adminRouter.get("/dashboard", adminController.dashboard);

adminRouter.get("/products", adminController.products);
adminRouter.post("/products", adminController.createProduct);
adminRouter.patch("/products/:id", adminController.updateProduct);
adminRouter.delete("/products/:id", adminController.deleteProduct);
adminRouter.get("/products/:id/home-sections", adminHomeController.productSections);
adminRouter.put("/products/:id/home-sections", adminHomeController.setProductSections);
// Só aqui o corpo é lido como binário (até 5 MB); no resto da API continua o limite de 10 kb em JSON.
adminRouter.post("/uploads", express.raw({ type: IMAGE_MIME_TYPES, limit: "5mb" }), adminController.uploadImage);

// Secções da página inicial (produto em destaque, ofertas, novidades, mais vendidos, recomendados).
adminRouter.get("/home-sections", adminHomeController.list);
adminRouter.get("/home-sections/:slug", adminHomeController.get);
adminRouter.put("/home-sections/:slug/products", adminHomeController.replace);
adminRouter.post("/home-sections/:slug/products", adminHomeController.add);
adminRouter.delete("/home-sections/:slug/products/:productId", adminHomeController.remove);

adminRouter.get("/categories", adminController.categories);
adminRouter.post("/categories", adminController.createCategory);
adminRouter.patch("/categories/:id", adminController.updateCategory);
adminRouter.delete("/categories/:id", adminController.deleteCategory);

adminRouter.get("/customers", adminController.customers);
adminRouter.get("/drivers", adminController.drivers);
adminRouter.post("/drivers", adminController.createDriver);
adminRouter.patch("/drivers/:id", adminController.updateDriver);
adminRouter.delete("/drivers/:id", adminController.deleteDriver);

adminRouter.get("/orders", adminController.orders);
adminRouter.put("/orders/:id/driver", adminController.assignOrderDriver);
adminRouter.get("/orders/:id/events", adminController.orderEvents);
adminRouter.patch("/orders/:id/status", adminController.updateOrderStatus);
adminRouter.delete("/orders/:id", adminController.deleteOrder);
adminRouter.post("/orders/bulk-status", adminController.bulkUpdateOrderStatus);
adminRouter.post("/orders/bulk-delete", adminController.bulkDeleteOrders);
