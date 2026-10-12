import { supabase } from "../config/supabase.js";
import { HttpError } from "../utils/httpError.js";

export const publicProductsRepository = {
  async list() {
    const { data, error } = await supabase.from("products")
      .select("id,name,description,price,category,image,images,specs,stock,active")
      .eq("active", true).order("created_at", { ascending: false });
    if (error) { console.error("[db]", error.message); throw new HttpError(500, "Não foi possível carregar os produtos."); }
    return (data ?? []).map((r: any) => ({ ...r, images: r.images ?? [], specs: r.specs ?? [], price: Number(r.price), available: r.stock > 0 }));
  }
};
