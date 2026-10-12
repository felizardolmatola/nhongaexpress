import { useEffect, useState } from "react";
import { api, type DeliveryQuote } from "../services/api";

type Props = {
  /** Com `orderId`: mostra a localização do entregador desse pedido. Sem ele: taxa de entrega do checkout. */
  orderId?: string;
  /** Bairro escolhido na morada de entrega. */
  neighborhood?: string;
  /** Cotação atual (controlada pelo checkout). Sem esta prop, o componente guarda a sua própria. */
  quote?: DeliveryQuote | null;
  onQuote?: (quote: DeliveryQuote | null) => void;
};

const txt = "m-0 text-[14px] text-muted";
const link = "font-semibold text-brand";
const mapUrl = (p: { latitude: number; longitude: number }) => `https://www.openstreetmap.org/?mlat=${p.latitude}&mlon=${p.longitude}#map=16/${p.latitude}/${p.longitude}`;

/** Localização do entregador de um pedido (actualiza a cada 5 segundos). */
function DriverTracking({ orderId }: { orderId: string }) {
  const [driver, setDriver] = useState<{ latitude: number; longitude: number; updated_at: string } | null>(null);
  useEffect(() => {
    let alive = true;
    const load = async () => { try { const r = await api.deliveryLocation(orderId); if (alive) setDriver(r.location); } catch { /* sem localização publicada */ } };
    void load(); const timer = window.setInterval(load, 5000);
    return () => { alive = false; window.clearInterval(timer); };
  }, [orderId]);
  return <section className="panel flex flex-col gap-2 bg-white max-[601px]:p-4">
    <h4 className="mt-0 mb-[5px]">Localização do entregador</h4>
    {driver
      ? <><p className={txt}>Última actualização: {new Date(driver.updated_at).toLocaleTimeString("pt-MZ")}</p><a className={link} href={mapUrl(driver)} target="_blank" rel="noreferrer">Ver entregador no mapa ↗</a></>
      : <p className={txt}>A localização será mostrada quando o entregador começar a partilhá-la.</p>}
    <small className="text-[12px] text-muted">O seguimento do entregador actualiza a cada 5 segundos.</small>
  </section>;
}

/** Taxa de entrega fixa do bairro escolhido: obtida sozinha ao escolher o bairro (sem GPS, sem botões). */
function ZoneFee({ neighborhood, quote: quoteProp, onQuote }: { neighborhood: string; quote?: DeliveryQuote | null; onQuote?: (quote: DeliveryQuote | null) => void }) {
  const [ownQuote, setOwnQuote] = useState<DeliveryQuote | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [attempt, setAttempt] = useState(0);
  const controlled = quoteProp !== undefined;
  const quote = controlled ? quoteProp : ownQuote;
  // Falta a taxa deste bairro (nova escolha, cotação expirada ou apagada pelo checkout): vai buscá-la.
  const missing = Boolean(neighborhood) && quote?.neighborhood !== neighborhood;
  useEffect(() => {
    const setQuote = (q: DeliveryQuote | null) => { if (!controlled) setOwnQuote(q); onQuote?.(q); };
    if (!neighborhood) { setMessage(""); if (quote) setQuote(null); return; }
    if (!missing) return;
    let alive = true;
    setBusy(true); setMessage("");
    api.deliveryQuote({ city: "Beira", neighborhood })
      .then((r) => { if (alive) setQuote(r.quote); })
      .catch((e) => { if (alive) { setQuote(null); setMessage(e instanceof Error ? e.message : "Não foi possível obter a taxa de entrega."); } })
      .finally(() => { if (alive) setBusy(false); });
    return () => { alive = false; };
  }, [neighborhood, missing, attempt]); // eslint-disable-line react-hooks/exhaustive-deps
  return <section className="panel flex flex-col gap-3 bg-white max-[601px]:p-4" aria-live="polite">
    <div><h3 className="mt-0 mb-[5px]">Taxa de entrega · Beira</h3>
      <p className={txt}>{neighborhood ? `Taxa fixa para o bairro ${neighborhood}.` : "Escolha o seu bairro na morada de entrega, acima, para ver a taxa de entrega."}</p></div>
    {busy && <p className="m-0 text-[13px] text-muted" role="status">A obter a taxa de entrega…</p>}
    {message && <div className="flex flex-col items-start gap-2"><p className="m-0 text-[13px] text-bad" role="alert">{message}</p><button type="button" className="btn ghost" disabled={busy} onClick={() => setAttempt((n) => n + 1)}>Tentar novamente</button></div>}
    {quote && quote.neighborhood === neighborhood && <div className="flex items-center justify-between gap-3 rounded-lg bg-soft p-3">
      <span className="text-[13px] text-muted">Taxa de entrega</span><strong className="text-[16px] text-ink">{quote.priceMzn.toLocaleString("pt-MZ")} MT</strong></div>}
  </section>;
}

export default function DeliveryLive({ orderId, neighborhood = "", quote, onQuote }: Props) {
  return orderId ? <DriverTracking orderId={orderId} /> : <ZoneFee neighborhood={neighborhood} quote={quote} onQuote={onQuote} />;
}
