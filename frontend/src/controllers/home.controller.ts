/**
 * controllers/home.controller.ts — secções da página inicial.
 * `adminHomeController` (atrás de requireAdmin) e `homeController` (público, só leitura).
 * Erros: HttpError → o errorHandler responde { message }, como no resto da API.
 */
import type { Request, Response } from "express";
import { z } from "zod";
import { HttpError } from "../utils/httpError.js";
import { homeRepository } from "../repositories/home.repository.js";
import { HOME_SECTIONS, HOME_SECTION_SLUGS, isHomeSection, type HomeSectionSlug } from "../utils/homeSections.js";

const uuid = z.string().uuid();

const sectionFrom = (req: Request): HomeSectionSlug => {
  const slug = String(req.params.slug);
  if (!isHomeSection(slug)) throw new HttpError(404, "Secção não encontrada.");
  return slug;
};
const parseOr400 = <T>(schema: z.ZodType<T>, body: unknown, message: string): T => {
  const r = schema.safeParse(body ?? {});
  if (!r.success) throw new HttpError(400, message);
  return r.data;
};

const view = async (slug: HomeSectionSlug, onlyActive: boolean) => ({
  slug,
  title: HOME_SECTIONS[slug].title,
  limit: HOME_SECTIONS[slug].limit,
  products: await homeRepository.listSection(slug, onlyActive),
});

export const adminHomeController = {
  /** GET /api/admin/home-sections — todas as secções com os seus produtos (inclui inativos). */
  list: async (_req: Request, res: Response) => {
    res.json({ sections: await Promise.all(HOME_SECTION_SLUGS.map((s) => view(s, false))) });
  },

  /** GET /api/admin/home-sections/:slug */
  get: async (req: Request, res: Response) => {
    res.json({ section: await view(sectionFrom(req), false) });
  },

  /** PUT /api/admin/home-sections/:slug/products — define a lista completa e a ordem. */
  replace: async (req: Request, res: Response) => {
    const slug = sectionFrom(req);
    const { limit } = HOME_SECTIONS[slug];
    const { productIds } = parseOr400(z.object({ productIds: z.array(uuid).max(limit) }), req.body, `Envie productIds (máximo ${limit}).`);
    const ids = [...new Set(productIds)];
    if ((await homeRepository.countExisting(ids)) !== ids.length) throw new HttpError(400, "Um ou mais produtos não existem.");
    await homeRepository.replace(slug, ids);
    res.json({ section: await view(slug, false) });
  },

  /** POST /api/admin/home-sections/:slug/products — acrescenta um produto (no destaque, substitui o atual). */
  add: async (req: Request, res: Response) => {
    const slug = sectionFrom(req);
    const { productId } = parseOr400(z.object({ productId: uuid }), req.body, "Indique o productId.");
    if ((await homeRepository.countExisting([productId])) !== 1) throw new HttpError(400, "O produto não existe.");
    const { limit } = HOME_SECTIONS[slug];
    if (limit === 1) await homeRepository.replace(slug, [productId]);
    else {
      if ((await homeRepository.count(slug)) >= limit) throw new HttpError(409, `Esta secção já tem o máximo de ${limit} produtos.`);
      await homeRepository.add(slug, productId);
    }
    res.status(201).json({ section: await view(slug, false) });
  },

  /** DELETE /api/admin/home-sections/:slug/products/:productId — tira da secção (não apaga o produto). */
  remove: async (req: Request, res: Response) => {
    const slug = sectionFrom(req);
    if (!(await homeRepository.remove(slug, String(req.params.productId)))) throw new HttpError(404, "O produto não está nesta secção.");
    res.status(204).end();
  },

  /** GET /api/admin/products/:id/home-sections — secções em que o produto aparece. */
  productSections: async (req: Request, res: Response) => {
    const id = parseOr400(uuid, req.params.id, "Produto inválido.");
    res.json({ sections: await homeRepository.sectionsOf(id) });
  },

  /** PUT /api/admin/products/:id/home-sections — define de uma vez as secções do produto (corpo: sections[]). */
  setProductSections: async (req: Request, res: Response) => {
    const id = parseOr400(uuid, req.params.id, "Produto inválido.");
    const { sections } = parseOr400(z.object({ sections: z.array(z.string()) }), req.body, "Secções inválidas.");
    if (!sections.every(isHomeSection)) throw new HttpError(400, "Secções inválidas.");
    if ((await homeRepository.countExisting([id])) !== 1) throw new HttpError(404, "Produto não encontrado.");

    const wanted = new Set(sections as HomeSectionSlug[]);
    const current = new Set(await homeRepository.sectionsOf(id));
    for (const slug of HOME_SECTION_SLUGS) {
      if (wanted.has(slug) && !current.has(slug)) {
        if (HOME_SECTIONS[slug].limit === 1) await homeRepository.replace(slug, [id]); // destaque: passa a ser este produto
        else if ((await homeRepository.count(slug)) >= HOME_SECTIONS[slug].limit) throw new HttpError(409, `A secção "${HOME_SECTIONS[slug].title}" já está cheia.`);
        else await homeRepository.add(slug, id);
      } else if (!wanted.has(slug) && current.has(slug)) {
        await homeRepository.remove(slug, id);
      }
    }
    res.json({ sections: [...wanted] });
  },
};

export const homeController = {
  /** GET /api/home — o que a página inicial mostra: destaque + vitrines (só produtos ativos). */
  get: async (_req: Request, res: Response) => {
    const views = await Promise.all(HOME_SECTION_SLUGS.map((s) => view(s, true)));
    const featured = views.find((v) => v.slug === "featured")?.products[0] ?? null;
    res.setHeader("Cache-Control", "public, max-age=30");
    res.json({
      featured,
      sections: views.filter((v) => v.slug !== "featured").map(({ slug, title, products }) => ({ slug, title, products })),
    });
  },
};
