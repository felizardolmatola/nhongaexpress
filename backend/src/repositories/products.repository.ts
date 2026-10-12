
import { supabase } from "../config/supabase.js";
import { HttpError } from "../utils/httpError.js";

const columns = "id,name,description,price,category,image,images,specs,stock,active,created_at,updated_at";
const map = (r: any) => ({ id:r.id, name:r.name, description:r.description ?? "", price:Number(r.price), category:r.category, image:r.image ?? "", images:r.images ?? [], specs:r.specs ?? [], stock:r.stock, active:r.active, createdAt:r.created_at, updatedAt:r.updated_at });

const fail = (e:any):never => { console.error("[db]", e?.message); throw new HttpError(500,"Erro interno. Tente novamente mais tarde."); };

export const productsRepository = {
  async list() { const {data,error}=await supabase.from("products").select(columns).order("created_at",{ascending:false}); if(error) fail(error); return (data??[]).map(map); },
  async create(d:any) { const {data,error}=await supabase.from("products").insert({name:d.name,description:d.description,price:d.price,category:d.category,image:d.image,images:d.images ?? [],specs:d.specs ?? [],stock:d.stock,active:d.active}).select(columns).single(); if(error) fail(error); return map(data); },
  async update(id:string,d:any) { const {data,error}=await supabase.from("products").update(d).eq("id",id).select(columns).single(); if(error){if(error.code==="PGRST116")throw new HttpError(404,"Produto não encontrado.");fail(error)} return map(data); },
  async remove(id:string) { const {error}=await supabase.from("products").delete().eq("id",id); if(error)fail(error); },
};
