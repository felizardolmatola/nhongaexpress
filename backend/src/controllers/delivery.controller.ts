import type { Request, Response } from "express";
import { supabase } from "../config/supabase.js";
import { HttpError } from "../utils/httpError.js";
import { deliveryService, validCoord } from "../services/delivery.service.js";

const beiraOnly = (city: unknown) => String(city ?? "").trim().toLocaleLowerCase("pt-MZ").includes("beira");

export const deliveryController = {
  /**
   * POST /api/delivery/quote — devolve a taxa fixa do bairro e um `quoteToken` assinado.
   * Corpo: { city, neighborhood }.
   */
  quote: async (req:Request,res:Response) => {
    const {city,neighborhood}=req.body ?? {};
    if(!beiraOnly(city)) throw new HttpError(400,"A entrega está disponível apenas na cidade da Beira.");
    const quote = await deliveryService.quoteForNeighborhood(typeof neighborhood==="string" ? neighborhood.trim() : "");
    res.setHeader("Cache-Control","no-store");
    res.json(quote);
  },
  /** GET /api/delivery/zones — público: bairros com a taxa fixa (priceMzn = null se ainda não definida). */
  zones: async (_req:Request,res:Response) => {
    const zones=await deliveryService.listZones();
    res.setHeader("Cache-Control","no-store");
    res.json({zones:zones.map(z=>({neighborhood:z.neighborhood,available:z.feeMzn!==null,priceMzn:z.feeMzn}))});
  },
  /** GET /api/delivery/zones/admin — administrador: bairros com a taxa de cada um. */
  adminZones: async (_req:Request,res:Response) => {
    res.setHeader("Cache-Control","no-store");
    res.json({zones:await deliveryService.listZones()});
  },
  /** PUT /api/delivery/zones/:neighborhood — administrador: define a taxa fixa (MT) do bairro. Corpo: { feeMzn }. */
  saveZone: async (req:Request,res:Response) => {
    await deliveryService.saveZoneFee(String(req.params.neighborhood),(req.body ?? {}).feeMzn);
    res.json({ok:true});
  },
  updateLocation: async (req:Request,res:Response) => {
    const {orderId,latitude,longitude,heading,speed}=req.body ?? {};
    if(typeof orderId!=="string"||!orderId||!validCoord(latitude)||latitude < -90||latitude>90||!validCoord(longitude)||longitude < -180||longitude>180) throw new HttpError(400,"Pedido ou coordenadas inválidas.");
    const {data:order,error:orderError}=await supabase.from("orders").select("id,status,driver_id").eq("id",orderId).maybeSingle();
    if(orderError||!order) throw new HttpError(404,"Pedido não encontrado.");
    if(!order.driver_id) throw new HttpError(409,"Atribua um entregador ao pedido antes de partilhar a localização.");
    if(["completed","cancelled"].includes(order.status)) throw new HttpError(409,"A localização não é aceite para pedidos terminados.");
    const {error}=await supabase.from("delivery_locations").upsert({order_id:orderId,latitude,longitude,heading:validCoord(heading)?heading:null,speed:validCoord(speed)?speed:null,updated_at:new Date().toISOString()},{onConflict:"order_id"});
    if(error) throw new HttpError(500,"Não foi possível actualizar a localização.");
    res.json({ok:true,updatedAt:new Date().toISOString()});
  },
  location: async (req:Request,res:Response) => {
    const {data:order,error:orderError}=await supabase.from("orders").select("id,user_id,status").eq("id",String(req.params.id)).eq("user_id",req.userId).maybeSingle();
    if(orderError||!order) throw new HttpError(404,"Pedido não encontrado.");
    if(["completed","cancelled"].includes(order.status)) return res.json({location:null});
    const {data,error}=await supabase.from("delivery_locations").select("latitude,longitude,heading,speed,updated_at").eq("order_id",order.id).maybeSingle();
    if(error) throw new HttpError(500,"Não foi possível consultar a localização.");
    res.setHeader("Cache-Control","no-store"); res.json({location:data??null});
  }
};
