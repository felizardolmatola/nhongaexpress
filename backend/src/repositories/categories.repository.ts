/**
 * repositories/categories.repository.ts — categorias da loja (nome + imagem do ícone).
 * Os produtos ligam-se à categoria pelo NOME (products.category); por isso, ao mudar o nome
 * de uma categoria, os produtos dela são atualizados também, e uma categoria com produtos não se elimina.
 */
import { supabase } from "../config/supabase.js";
import { HttpError } from "../utils/httpError.js";

export type CategoryRow = { id: string; name: string; iconUrl: string; position: number };
export type CategoryAdminRow = CategoryRow & { productCount: number };

const COLS = "id,name,icon_url,position";
const toRow = (r: any): CategoryRow => ({ id: r.id, name: r.name, iconUrl: r.icon_url ?? "", position: Number(r.position) });
const isDuplicate = (e: any) => e?.code === "23505";
const fail = (e: any, message: string): never => { console.error("[db]", e?.message); throw new HttpError(500, message); };
const DUPLICATE = "Já existe uma categoria com esse nome.";

export const categoriesRepository = {
  /** Lista pública (loja): por ordem. */
  async list(): Promise<CategoryRow[]> {
    const { data, error } = await supabase.from("categories").select(COLS).order("position", { ascending: true }).order("name", { ascending: true });
    if (error) fail(error, "Não foi possível carregar as categorias.");
    return (data ?? []).map(toRow);
  },

  /** Lista do painel: cada categoria com o número de produtos que a usam. */
  async listWithCounts(): Promise<CategoryAdminRow[]> {
    const rows = await categoriesRepository.list();
    const { data, error } = await supabase.from("products").select("category");
    if (error) fail(error, "Não foi possível carregar as categorias.");
    const counts = new Map<string, number>();
    for (const p of (data ?? []) as any[]) counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
    return rows.map((r) => ({ ...r, productCount: counts.get(r.name) ?? 0 }));
  },

  async get(id: string): Promise<CategoryRow> {
    const { data, error } = await supabase.from("categories").select(COLS).eq("id", id).maybeSingle();
    if (error) fail(error, "Não foi possível carregar a categoria.");
    if (!data) throw new HttpError(404, "Categoria não encontrada.");
    return toRow(data);
  },

  async create(input: { name: string; iconUrl: string }): Promise<CategoryAdminRow> {
    const { data: last } = await supabase.from("categories").select("position").order("position", { ascending: false }).limit(1);
    const position = Number(last?.[0]?.position ?? 0) + 1;
    const { data, error } = await supabase.from("categories").insert({ name: input.name, icon_url: input.iconUrl, position }).select(COLS).single();
    if (isDuplicate(error)) throw new HttpError(409, DUPLICATE);
    if (error) fail(error, "Não foi possível criar a categoria.");
    return { ...toRow(data), productCount: 0 };
  },

  /** Muda nome e/ou imagem do ícone. Se o nome mudar, os produtos da categoria passam para o nome novo. */
  async update(id: string, patch: { name?: string; iconUrl?: string }): Promise<CategoryAdminRow> {
    const current = await categoriesRepository.get(id);
    const change: Record<string, string> = { updated_at: new Date().toISOString() };
    if (patch.name !== undefined) change.name = patch.name;
    if (patch.iconUrl !== undefined) change.icon_url = patch.iconUrl;

    const { data, error } = await supabase.from("categories").update(change).eq("id", id).select(COLS).single();
    if (isDuplicate(error)) throw new HttpError(409, DUPLICATE);
    if (error) fail(error, "Não foi possível guardar a categoria.");

    const renamed = patch.name !== undefined && patch.name !== current.name;
    if (renamed) {
      const moved = await supabase.from("products").update({ category: patch.name }).eq("category", current.name);
      if (moved.error) {
        // Desfaz o novo nome para a categoria e os produtos não ficarem desencontrados.
        await supabase.from("categories").update({ name: current.name }).eq("id", id);
        fail(moved.error, "Não foi possível atualizar os produtos desta categoria.");
      }
    }
    const name = (data as any).name as string;
    const { count } = await supabase.from("products").select("id", { count: "exact", head: true }).eq("category", name);
    return { ...toRow(data), productCount: count ?? 0 };
  },

  /** Elimina a categoria SÓ se nenhum produto a usar. */
  async remove(id: string): Promise<void> {
    const current = await categoriesRepository.get(id);
    const { count, error: countError } = await supabase.from("products").select("id", { count: "exact", head: true }).eq("category", current.name);
    if (countError) fail(countError, "Não foi possível eliminar a categoria.");
    if ((count ?? 0) > 0) {
      throw new HttpError(409, `Há ${count} produto(s) nesta categoria. Mude-os para outra categoria antes de a eliminar.`);
    }
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) fail(error, "Não foi possível eliminar a categoria.");
  },
};
