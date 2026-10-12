import type { Request, Response } from "express";
import { z } from "zod";
import { HttpError } from "../utils/httpError.js";
import { productsRepository } from "../repositories/products.repository.js";
import { adminRepository } from "../repositories/admin.repository.js";
import { productImagesRepository } from "../repositories/productImages.repository.js";
import { categoriesRepository } from "../repositories/categories.repository.js";
import { driversRepository } from "../repositories/drivers.repository.js";
import { parsePhone } from "../utils/identifier.js";
import { detectImage } from "../utils/image.js";
import { env } from "../config/env.js";

// Campos SEM valores por defeito: é a base do esquema de edição (PATCH). No Zod 4, `.partial()` sobre campos com
// `.default()` voltaria a aplicar o defeito e apagaria stock, descrição, imagens e specs só por mudar o nome.
const productFields = z.object({
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(2000),
  price: z.coerce.number().nonnegative(),
  category: z.string().trim().min(1).max(80),
  image: z.string().trim().max(1000),
  images: z.array(z.string().trim().min(1).max(1000)).max(5),
  // Especificações: linhas "característica → valor", por ordem (ex.: Bateria → 30 horas).
  specs: z.array(z.object({
    label: z.string().trim().min(1).max(60),
    value: z.string().trim().min(1).max(200),
  })).max(20),
  stock: z.coerce.number().int().nonnegative(),
  active: z.boolean(),
});
// Criar: o que não vier toma o valor por defeito.
const productSchema = productFields.extend({
  description: productFields.shape.description.default(""),
  image: productFields.shape.image.default(""),
  images: productFields.shape.images.default([]),
  specs: productFields.shape.specs.default([]),
  stock: productFields.shape.stock.default(0),
  active: productFields.shape.active.default(true),
});
// Editar: só muda o que vier no corpo.
const productPatchSchema = productFields.partial();

const categoryName = z.string().trim().min(2, "O nome da categoria deve ter pelo menos 2 letras.").max(60, "O nome da categoria é demasiado longo.");
// URL devolvido por POST /api/admin/uploads (imagem no nosso Storage); vazio = sem ícone.
const categoryIcon = z.string().trim().max(1000).refine(
  (u) => u === "" || u.startsWith(`${env.SUPABASE_URL}/storage/v1/object/public/`),
  "Ícone inválido: carregue a imagem pelo painel.",
);
const categorySchema = z.object({ name: categoryName, iconUrl: categoryIcon.default("") });
const categoryPatchSchema = z.object({ name: categoryName, iconUrl: categoryIcon }).partial();
const categoryId = z.string().uuid("Categoria inválida.");

// Entregadores: o telefone é normalizado para +258XXXXXXXXX (aceita "84 123 4567", "+258841234567"...).
const driverPhone = z.string().trim()
  .refine((v) => parsePhone(v) !== null, "Telefone inválido. Use um número móvel de Moçambique (ex.: 84 123 4567).")
  .transform((v) => parsePhone(v) as string);
const driverBase = z.object({
  name: z.string().trim().min(2, "O nome deve ter pelo menos 2 letras.").max(100, "O nome é demasiado longo."),
  phone: driverPhone,
  vehicle: z.string().trim().max(60, "O veículo é demasiado longo."),
  active: z.boolean(),
});
// Criar: o veículo é opcional e o entregador nasce ativo. Editar: só muda o que vier no corpo.
// (Sem `.default()` no esquema de edição: no Zod 4 o `.partial()` voltaria a aplicar os valores por defeito
// e, por exemplo, reativaria um entregador desativado só por se mudar o nome.)
const driverCreateSchema = driverBase.omit({ vehicle: true, active: true }).extend({ vehicle: driverBase.shape.vehicle.default("") });
const driverPatchSchema = driverBase.partial();
const driverId = z.string().uuid("Entregador inválido.");
const orderId = z.string().uuid("Pedido inválido.");

const orderStatus = z.enum(["pending", "paid", "processing", "shipped", "completed", "cancelled"]);
const bulkIds = z.object({ ids: z.array(z.string().uuid("Pedido inválido.")).min(1, "Selecione pelo menos um pedido.").max(100, "Máximo de 100 pedidos de cada vez.") });

export const adminController = {
  me: (req: Request, res: Response) => res.json({ admin: req.admin }),
  dashboard: async (_req: Request, res: Response) => res.json(await adminRepository.dashboard()),
  customers: async (_req: Request, res: Response) => res.json({ customers: await adminRepository.customers() }),
  orders: async (_req: Request, res: Response) => res.json({ orders: await adminRepository.orders() }),
  products: async (_req: Request, res: Response) => res.json({ products: await productsRepository.list() }),
  createProduct: async (req: Request, res: Response) => {
    const data = productSchema.parse(req.body);
    res.status(201).json({ product: await productsRepository.create(data) });
  },
  updateProduct: async (req: Request, res: Response) => {
    const data = productPatchSchema.parse(req.body);
    if (Object.keys(data).length === 0) throw new HttpError(400, "Nada para alterar.");
    res.json({ product: await productsRepository.update(String(req.params.id), data) });
  },
  /** Categorias (nome + imagem do ícone). Mudar o nome atualiza também os produtos da categoria. */
  categories: async (_req: Request, res: Response) => res.json({ categories: await categoriesRepository.listWithCounts() }),
  createCategory: async (req: Request, res: Response) => {
    const data = categorySchema.parse(req.body);
    res.status(201).json({ category: await categoriesRepository.create(data) });
  },
  updateCategory: async (req: Request, res: Response) => {
    const id = categoryId.parse(req.params.id);
    const data = categoryPatchSchema.parse(req.body);
    if (data.name === undefined && data.iconUrl === undefined) throw new HttpError(400, "Nada para alterar.");
    res.json({ category: await categoriesRepository.update(id, data) });
  },
  deleteCategory: async (req: Request, res: Response) => {
    await categoriesRepository.remove(categoryId.parse(req.params.id));
    res.status(204).end();
  },
  updateOrderStatus: async (req: Request, res: Response) => {
    const body = z.object({ status: orderStatus }).parse(req.body);
    res.json({ order: await adminRepository.setOrderStatus(String(req.params.id), body.status) });
  },
  /** Entregadores: cadastro, edição, ativar/desativar e eliminar (só quem nunca teve pedidos). */
  drivers: async (_req: Request, res: Response) => res.json({ drivers: await driversRepository.list() }),
  createDriver: async (req: Request, res: Response) => {
    const { name, phone, vehicle } = driverCreateSchema.parse(req.body);
    res.status(201).json({ driver: await driversRepository.create({ name, phone, vehicle }) });
  },
  updateDriver: async (req: Request, res: Response) => {
    const id = driverId.parse(req.params.id);
    const data = driverPatchSchema.parse(req.body);
    if (Object.keys(data).length === 0) throw new HttpError(400, "Nada para alterar.");
    res.json({ driver: await driversRepository.update(id, data) });
  },
  deleteDriver: async (req: Request, res: Response) => {
    await driversRepository.remove(driverId.parse(req.params.id));
    res.status(204).end();
  },
  /** PUT /api/admin/orders/:id/driver — corpo: { driverId: uuid | null } (null retira o entregador). */
  assignOrderDriver: async (req: Request, res: Response) => {
    const id = orderId.parse(req.params.id);
    const body = z.object({ driverId: driverId.nullable() }).parse(req.body);
    res.json({ order: await adminRepository.assignDriver(id, body.driverId) });
  },
  /** GET /api/admin/orders/:id/events — linha do tempo (estados e entregador). */
  orderEvents: async (req: Request, res: Response) => res.json({ events: await adminRepository.orderEvents(orderId.parse(req.params.id)) }),
  /** DELETE /api/admin/orders/:id — elimina um pedido. Pagos e entregues não se eliminam (409). */
  deleteOrder: async (req: Request, res: Response) => {
    const id = z.string().uuid("Pedido inválido.").parse(req.params.id);
    const { deleted, blocked } = await adminRepository.removeOrders([id]);
    if (blocked.length > 0) throw new HttpError(409, "Pedidos pagos ou entregues não podem ser eliminados. Cancele o pedido pago primeiro.");
    if (deleted.length === 0) throw new HttpError(404, "Pedido não encontrado.");
    res.status(204).end();
  },
  /** POST /api/admin/orders/bulk-delete — elimina vários pedidos (corpo: ids[]). Os pagos/entregues ficam de fora e contam em `skipped`. */
  bulkDeleteOrders: async (req: Request, res: Response) => {
    const { ids } = bulkIds.parse(req.body);
    const { deleted, blocked } = await adminRepository.removeOrders(ids);
    res.json({ deleted, skipped: blocked.length });
  },
  /** POST /api/admin/orders/bulk-status — muda o estado de vários pedidos (corpo: ids[], status). Os que não podem mudar (ex.: cancelados) ficam de fora. */
  bulkUpdateOrderStatus: async (req: Request, res: Response) => {
    const { ids, status } = bulkIds.extend({ status: orderStatus }).parse(req.body);
    const updated: Awaited<ReturnType<typeof adminRepository.setOrderStatus>>[] = [];
    let skipped = 0;
    for (const id of ids) {
      try { updated.push(await adminRepository.setOrderStatus(id, status)); }
      catch (e) { if (e instanceof HttpError && e.status < 500) skipped++; else throw e; }
    }
    res.json({ updated, skipped });
  },
  /** Recebe a imagem em binário (ver express.raw em admin.routes.ts) e devolve o URL público. */
  uploadImage: async (req: Request, res: Response) => {
    const file = req.body;
    if (!Buffer.isBuffer(file) || file.length === 0) throw new HttpError(415, "Envie uma imagem JPG, PNG, WebP ou AVIF.");
    const kind = detectImage(file);
    if (!kind) throw new HttpError(415, "O ficheiro não é uma imagem válida (JPG, PNG, WebP ou AVIF).");
    res.status(201).json({ url: await productImagesRepository.upload(file, kind) });
  },
  deleteProduct: async (req: Request, res: Response) => {
    await productsRepository.remove(String(req.params.id));
    res.status(204).end();
  },
};
