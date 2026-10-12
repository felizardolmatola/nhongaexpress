
import { supabase } from "../config/supabase.js";
import { HttpError } from "../utils/httpError.js";
import { driversRepository, OPEN_ORDER_STATUSES } from "./drivers.repository.js";

const fail=(e:any):never=>{console.error("[db]",e?.message);throw new HttpError(500,"Erro interno. Tente novamente mais tarde.");};

export const adminRepository = {
  async dashboard() {
    const [users, products, orders] = await Promise.all([
      supabase.from("users").select("id",{count:"exact",head:true}).eq("role","customer"),
      supabase.from("products").select("id",{count:"exact",head:true}).eq("active",true),
      supabase.from("orders").select("id,total,status,created_at").order("created_at",{ascending:false}).limit(100),
    ]);
    if(users.error)fail(users.error); if(products.error)fail(products.error); if(orders.error)fail(orders.error);
    const rows=(orders.data??[]) as any[];
    return {
      stats:{customers:users.count??0,products:products.count??0,orders:rows.length,revenue:rows.reduce((n,r)=>n+Number(r.total||0),0)},
      recentOrders:rows.slice(0,8).map(r=>({id:r.id,total:Number(r.total||0),status:r.status,createdAt:r.created_at}))
    };
  },
  async customers() {
    const {data,error}=await supabase.from("users").select("id,name,email,phone,created_at").eq("role","customer").order("created_at",{ascending:false});
    if(error)fail(error); return (data??[]).map((r:any)=>({id:r.id,name:r.name,email:r.email,phone:r.phone,createdAt:r.created_at}));
  },
  async orders() {
    const {data,error}=await supabase.from("orders").select("id,user_id,total,status,payment_method,shipping_address,delivery_method,driver_id,driver_assigned_at,created_at").order("created_at",{ascending:false});
    if(error)fail(error);
    const rows=(data??[]) as any[];
    const ids=[...new Set(rows.map(r=>r.user_id).filter(Boolean))];
    let users:any[]=[];
    if(ids.length){const u=await supabase.from("users").select("id,name,email").in("id",ids);if(u.error)fail(u.error);users=u.data??[];}
    const map=new Map(users.map(u=>[u.id,u]));

    // Entregador de cada pedido (nome e telefone, para o painel mostrar sem outra chamada).
    const driverIds=[...new Set(rows.map(r=>r.driver_id).filter(Boolean))];
    const drivers=new Map<string,{id:string;name:string;phone:string}>();
    if(driverIds.length){const d=await supabase.from("drivers").select("id,name,phone").in("id",driverIds);if(d.error)fail(d.error);for(const x of (d.data??[]) as any[])drivers.set(x.id,{id:x.id,name:x.name,phone:x.phone});}

    // Itens de cada pedido (o painel mostra-os ao abrir o pedido).
    const itemsByOrder=new Map<string,any[]>();
    if(rows.length){
      const it=await supabase.from("order_items").select("id,order_id,product_name,quantity,unit_price").in("order_id",rows.map(r=>r.id));
      if(it.error)fail(it.error);
      for(const i of (it.data??[]) as any[]){
        const list=itemsByOrder.get(i.order_id)??[];
        list.push({id:i.id,name:i.product_name,quantity:Number(i.quantity),unitPrice:Number(i.unit_price),subtotal:Number(i.quantity)*Number(i.unit_price)});
        itemsByOrder.set(i.order_id,list);
      }
    }

    return rows.map(r=>({id:r.id,userId:r.user_id,customer:map.get(r.user_id)?.name??"Cliente",email:map.get(r.user_id)?.email??"",total:Number(r.total||0),status:r.status,paymentMethod:r.payment_method,shippingAddress:r.shipping_address,deliveryMethod:r.delivery_method,driver:r.driver_id?(drivers.get(r.driver_id)??null):null,driverAssignedAt:r.driver_assigned_at??null,createdAt:r.created_at,items:(itemsByOrder.get(r.id)??[]).sort((a,b)=>a.name.localeCompare(b.name))}));
  },

  /** Muda o estado de um pedido. Um pedido cancelado não volta a abrir (o trigger da base de dados recusa com ORDER_CANCELLED). */
  async setOrderStatus(id:string,status:string) {
    const {data,error}=await supabase.from("orders").update({status}).eq("id",id).select("id,total,status,created_at").single();
    if(error?.message?.includes("ORDER_CANCELLED"))throw new HttpError(409,"Um pedido cancelado não pode ser reaberto.");
    if(error)throw new HttpError(error.code==="PGRST116"?404:500,error.code==="PGRST116"?"Pedido não encontrado.":"Não foi possível atualizar o pedido.");
    return {id:data.id as string,total:Number(data.total),status:data.status as string,createdAt:data.created_at as string};
  },

  /**
   * Atribui (ou retira, com `driverId = null`) o entregador de um pedido.
   * - Só pedidos ainda em curso (pendente, pago, em processamento, enviado): num pedido entregue ou cancelado o entregador fica como histórico.
   * - Só entregadores ativos recebem pedidos.
   * A condição de estado vai no próprio UPDATE, por isso não há corrida com uma mudança de estado feita ao mesmo tempo.
   */
  async assignDriver(orderId:string,driverId:string|null) {
    if(driverId){
      const driver=await driversRepository.get(driverId);
      if(!driver.active)throw new HttpError(409,"Este entregador está inativo. Ative-o antes de lhe atribuir pedidos.");
    }
    const {data,error}=await supabase.from("orders")
      .update({driver_id:driverId,driver_assigned_at:driverId?new Date().toISOString():null})
      .eq("id",orderId).in("status",[...OPEN_ORDER_STATUSES])
      .select("id,driver_id,driver_assigned_at").maybeSingle();
    if(error)fail(error);
    if(!data){
      const o=await supabase.from("orders").select("id,status").eq("id",orderId).maybeSingle();
      if(o.error)fail(o.error);
      if(!o.data)throw new HttpError(404,"Pedido não encontrado.");
      throw new HttpError(409,o.data.status==="cancelled"?"Um pedido cancelado não pode ter entregador.":"Este pedido já foi entregue; o entregador fica registado no histórico.");
    }
    const driver=data.driver_id?await driversRepository.get(data.driver_id as string):null;
    return {id:data.id as string,driver:driver?{id:driver.id,name:driver.name,phone:driver.phone}:null,driverAssignedAt:(data.driver_assigned_at as string|null)??null};
  },

  /** Linha do tempo do pedido: mudanças de estado e atribuições de entregador, da mais antiga para a mais recente. */
  async orderEvents(orderId:string) {
    const {data,error}=await supabase.from("order_events").select("id,kind,status,driver_name,created_at").eq("order_id",orderId).order("created_at",{ascending:true});
    if(error)fail(error);
    return (data??[]).map((e:any)=>({id:e.id as string,kind:e.kind as "status"|"driver",status:(e.status as string|null)??null,driverName:(e.driver_name as string|null)??null,createdAt:e.created_at as string}));
  },

  /**
   * Elimina pedidos (itens primeiro, depois o pedido). Devolve os ids realmente eliminados.
   * Stock: um pedido ainda NÃO enviado (pendente, pago ou em processamento) é cancelado antes de ser apagado,
   * e o trigger `orders_restock_on_cancel` devolve o stock à loja. Pedidos enviados, entregues ou já cancelados
   * não mexem no stock (os enviados/entregues já saíram; os cancelados já o devolveram).
   */
  async removeOrders(ids:string[]):Promise<string[]> {
    if(ids.length===0)return [];
    const found=await supabase.from("orders").select("id,status").in("id",ids);
    if(found.error)fail(found.error);
    const rows=(found.data??[]) as any[];
    if(rows.length===0)return [];

    const toRestock=rows.filter(r=>["pending","paid","processing"].includes(r.status)).map(r=>r.id);
    if(toRestock.length){
      const c=await supabase.from("orders").update({status:"cancelled"}).in("id",toRestock);
      if(c.error)fail(c.error);
    }
    const foundIds=rows.map(r=>r.id);
    const items=await supabase.from("order_items").delete().in("order_id",foundIds);
    if(items.error)fail(items.error);
    const del=await supabase.from("orders").delete().in("id",foundIds).select("id");
    if(del.error)fail(del.error);
    return (del.data??[]).map((r:any)=>r.id as string);
  }
};
