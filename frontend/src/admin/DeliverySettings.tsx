import { useEffect, useState } from "react";
import { adminApi, type DeliveryZone } from "./adminApi";

/** Mesmos 26 bairros e postos administrativos do checkout (BEIRA_ZONES em App.tsx). */
const POSTOS: { posto: string; bairros: string[] }[] = [
  { posto: "Posto Administrativo Central", bairros: ["Chaimite", "Chipangara", "Esturro", "Macurungo", "Macuti", "Matacuane", "Pioneiros", "Ponta-Gêa"] },
  { posto: "Posto Administrativo da Munhava", bairros: ["Chota", "Mananga", "Maraza", "Munhava-Central", "Vaz"] },
  { posto: "Posto Administrativo de Inhamízua", bairros: ["Alto da Manga", "Chingussura", "Inhamízua", "Matadouro", "Nhaconjo", "Vila Massane"] },
  { posto: "Posto Administrativo de Manga-Loforte", bairros: ["Manga Mascarenhas", "Muave", "Mungassa", "Ndunda"] },
  { posto: "Posto Administrativo de Nhangau", bairros: ["Nhangau", "Nhangoma", "Tchonja"] },
];
const MAX_FEE = 100000;
const FEE_RE = /^\d{1,6}$/;

/** Taxa de entrega FIXA por bairro (em MT). O cliente vê este valor ao escolher o bairro no checkout. */
export default function DeliverySettings(){
  const [saved,setSaved]=useState<Record<string,number|null>>({});
  const [drafts,setDrafts]=useState<Record<string,string>>({});
  const [busy,setBusy]=useState<string|null>(null);
  const [rowMsg,setRowMsg]=useState<Record<string,{ok:boolean;text:string}>>({});
  const [loadError,setLoadError]=useState("");
  useEffect(()=>{void adminApi.deliveryZones().then(({zones})=>{
    const fees:Record<string,number|null>={},texts:Record<string,string>={};
    for(const z of zones as DeliveryZone[]){fees[z.neighborhood]=z.feeMzn;texts[z.neighborhood]=z.feeMzn==null?"":String(z.feeMzn);}
    setSaved(fees);setDrafts(texts);
  }).catch(e=>setLoadError(e instanceof Error?e.message:"Não foi possível carregar os bairros."));},[]);
  const save=async(name:string)=>{
    const text=(drafts[name]??"").trim();
    const fee=Number(text);
    if(!FEE_RE.test(text)||fee>MAX_FEE){setRowMsg(p=>({...p,[name]:{ok:false,text:`Indique um valor inteiro em MT, entre 0 e ${MAX_FEE}.`}}));return;}
    setBusy(name);
    try{
      await adminApi.saveDeliveryZone(name,{feeMzn:fee});
      setSaved(p=>({...p,[name]:fee}));setDrafts(p=>({...p,[name]:String(fee)}));
      setRowMsg(p=>({...p,[name]:{ok:true,text:"Guardado."}}));
    }catch(e){setRowMsg(p=>({...p,[name]:{ok:false,text:e instanceof Error?e.message:"Falha ao guardar."}}));}
    finally{setBusy(null);}
  };
  return <section className="adm-card max-w-[720px]" style={{padding:24}}>
    <h2>Entrega · Taxa por bairro</h2>
    <p>Cada bairro da Cidade da Beira tem uma <strong>taxa de entrega fixa</strong>, em meticais (MT). É o valor que o cliente paga ao escolher o bairro no checkout. Um bairro sem taxa não permite finalizar o pedido.</p>
    {loadError&&<p role="alert">{loadError}</p>}
    {POSTOS.map(g=><div key={g.posto} className="mt-4">
      <h3 className="m-0 mb-1 text-[15px]">{g.posto}</h3>
      <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
        {g.bairros.map(name=>{const msg=rowMsg[name];const changed=(drafts[name]??"")!==(saved[name]==null?"":String(saved[name]));
          return <li key={name} className="flex flex-wrap items-center gap-2 border-t border-line pt-2.5">
            <span className="w-[150px] font-semibold">{name}</span>
            <input className="h-10 w-[120px] rounded-lg border border-line bg-white px-3 text-[14px] focus:border-brand focus:outline-none" type="text" inputMode="numeric" maxLength={6} placeholder="Ex.: 60" aria-label={`Taxa de entrega de ${name} em MT`} value={drafts[name]??""} onChange={e=>setDrafts(p=>({...p,[name]:e.target.value.replace(/\D/g,"").slice(0,6)}))}/>
            <span className="text-[13px] text-muted">MT</span>
            <button type="button" className="adm-btn sm" disabled={busy===name||!changed||(drafts[name]??"")===""} onClick={()=>save(name)}>{busy===name?"A guardar…":"Guardar"}</button>
            {msg&&<span role="status" className={`basis-full text-[12px] ${msg.ok?"text-ok":"text-bad"}`}>{msg.text}</span>}
          </li>;})}
      </ul>
    </div>)}
  </section>;
}
