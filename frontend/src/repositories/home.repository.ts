/**
 * repositories/home.repository.ts — secções da página inicial (Supabase, service_role).
 * Mesmo estilo dos outros repositórios: usa o cliente de ../config/supabase.js e lança HttpError.
 */
import { supabase } from "../config/supabase.js";
import { HttpError } from "../utils/httpError.js";
import type { HomeSectionSlug } from "../utils/homeSections.js";

const PRODUCT_COLUMNS = "id,name,description,price,category,image,images,specs,stock,active,created_at,updated_at";

type ProductRow = { id: string; name: string; description: string; price: number | string; category: string; image: string; images: string[] | null; specs: { label: string; value: string }[] | null; stock: number; active: boolean; created_at: string; updated_at: string };
const toProduct = (r: ProductRow) => ({
  id: r.id, name: r.name, description: r.description, price: Number(r.price), category: r.category,
  image: r.image, images: r.images ?? [], specs: r.specs ?? [], stock: r.stock, active: r.active, createdAt: r.created_at, updatedAt: r.updated_at,
});

const fail = (message: string): never => { throw new HttpError(500, message); };

export const homeRepository = {
  /** Produtos de uma secção, por ordem. `onlyActive` = true para a loja pública. */
  async listSection(section: HomeSectionSlug, onlyActive: boolean) {
    let query = supabase
      .from("home_section_products")
      .select(`position, products${onlyActive ? "!inner" : ""}(${PRODUCT_COLUMNS})`)
      .eq("section", section)
      .order("position", { ascending: true });
    if (onlyActive) query = query.eq("products.active", true);
    const { data, error } = await query;
    if (error) fail("Não foi possível carregar a secção.");
    return ((data ?? []) as unknown as { products: ProductRow | ProductRow[] | null }[])
      .map((r) => (Array.isArray(r.products) ? r.products[0] : r.products))
      .filter((p): p is ProductRow => !!p)
      .map(toProduct);
  },

  /** Quantos dos ids existem em `products` (recusa ids inventados). */
  async countExisting(ids: string[]) {
    if (!ids.length) return 0;
    const { count, error } = await supabase.from("products").select("id", { count: "exact", head: true }).in("id", ids);
    if (error) fail("Não foi possível validar os produtos.");
    return count ?? 0;
  },

  /** Substitui todos os produtos da secção, de forma atómica (função SQL replace_home_section). */
  async replace(section: HomeSectionSlug, ids: string[]) {
    const { error } = await supabase.rpc("replace_home_section", { p_section: section, p_product_ids: ids });
    if (error) fail("Não foi possível guardar a secção.");
  },

  /** Acrescenta no fim da secção (se já lá estiver, não faz nada). */
  async add(section: HomeSectionSlug, id: string) {
    const { data: last, error: e1 } = await supabase
      .from("home_section_products").select("position").eq("section", section)
      .order("position", { ascending: false }).limit(1);
    if (e1) fail("Não foi possível guardar a secção.");
    const next = last?.length ? Number(last[0].position) + 1 : 0;
    const { error } = await supabase
      .from("home_section_products")
      .upsert({ section, product_id: id, position: next }, { onConflict: "section,product_id", ignoreDuplicates: true });
    if (error) fail("Não foi possível guardar a secção.");
  },

  /** Tira o produto da secção. Devolve false se não lá estava. */
  async remove(section: HomeSectionSlug, id: string) {
    const { data, error } = await supabase.from("home_section_products").delete().eq("section", section).eq("product_id", id).select("product_id");
    if (error) fail("Não foi possível guardar a secção.");
    return (data?.length ?? 0) > 0;
  },

  async count(section: HomeSectionSlug) {
    const { count, error } = await supabase.from("home_section_products").select("product_id", { count: "exact", head: true }).eq("section", section);
    if (error) fail("Não foi possível carregar a secção.");
    return count ?? 0;
  },

  /** Secções em que um produto aparece. */
  async sectionsOf(productId: string) {
    const { data, error } = await supabase.from("home_section_products").select("section").eq("product_id", productId);
    if (error) fail("Não foi possível carregar as secções do produto.");
    return (data ?? []).map((r) => r.section as HomeSectionSlug);
  },
};
