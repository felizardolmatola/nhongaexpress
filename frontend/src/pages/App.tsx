/**
 * App.tsx — a loja NhongaExpress inteira num só ficheiro (TypeScript).
 *
 * Reúne o que antes estava em App.tsx, pages.tsx e Footer.tsx:
 *   1. RODAPÉ ........ componente Footer
 *   2. PÁGINAS ....... tipos Page e Store + Auth · Card/Grid · ProductDetail · Home ·
 *                      Categories · Search · Wishlist · Cart · Checkout · Account · About · Info
 *   3. APP ........... StoreApp: estado global (página, utilizador, carrinho, favoritos),
 *                      objeto `s` (Store) passado às páginas, cabeçalho, pesquisa, menu móvel
 *                      e toasts. É o export por defeito, carregado por main.tsx.
 */

import { useEffect, useRef, useState, type ChangeEvent, type CSSProperties, type FormEvent, type InputHTMLAttributes, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { api, ApiError, type ApiAddress, type ApiOrder, type ApiOrderItem, type ApiSettings, type ApiUser, type CartCheck, type DeliveryQuote } from "../services/api";
import { socialLogin, preloadSocial, SocialCancelled, type SocialProvider } from "../services/social";
import { Product, products, categories, setProducts, fmt, company } from "../services/data";
import { PAY_ICONS, MpesaIcon, EmolaIcon } from "./PaymentIcons";
import { ADMIN_BASE, clearNextParam, wantsAdmin } from "../services/route";
import { ICON_LIBRARY, setCategoryIcons, storedIconKey, suggestIconKey } from "../services/categoryIcons";
import DeliveryLive from "./DeliveryLive";

/* ========================================================================== */
/* 1. RODAPÉ                                                                  */
/* ========================================================================== */

/**
 * Ícone SVG genérico: recebe os traços (<path/>) como `children` e aplica tamanho e estilo comuns.
 */
const Ico = ({ children, size = 18 }: { children: ReactNode; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);

/** Ícone de mota (entrega). Usado em todo o site no lugar do carro/camião. */
const MOTO_PATH = "M5 16m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0M19 16m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0M7.5 14h5l4-4h-10.5m1.5 4l4-4M13 6h2l1.5 3 2 4";

/** Logótipo do "Pagamento na entrega": só a nota de dinheiro, em verde. Complementa os logos do M-Pesa e e-Mola. */
const CashOnDeliveryIcon = ({ height = 28 }: { height?: number }) => (
  <svg viewBox="0 0 48 32" width={height * 1.5} height={height} role="img" aria-label="Pagamento na entrega" xmlns="http://www.w3.org/2000/svg">
    <rect width="48" height="32" rx="7" fill="#1f8a4c" />
    <g transform="translate(12 8)" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect width="24" height="16" rx="2.5" /><circle cx="12" cy="8" r="3.2" /><path d="M4.5 4.5v.01M19.5 11.5v.01" />
    </g>
  </svg>
);
/** Logos por forma de pagamento (os de ./PaymentIcons + o do pagamento na entrega). */
const PAY_LOGOS: Record<string, ReactNode> = { ...PAY_ICONS, "Pagamento na entrega": <CashOnDeliveryIcon height={30} /> };

/**
 * Redes sociais mostradas no rodapé. Os links vêm de `company` (data.ts), por isso há um único sítio para editar.
 */
const socials: { name: string; href: string; icon: ReactNode }[] = [
  { name: "Facebook", href: company.facebook, icon: <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" /> },
  { name: "Instagram", href: company.instagram, icon: <><rect x="2" y="2" width="20" height="20" rx="5" /><path d="M16 11.4A4 4 0 1 1 12.6 8 4 4 0 0 1 16 11.4z" /><path d="M17.5 6.5h.01" /></> },
  { name: "WhatsApp", href: company.whatsapp ? `https://wa.me/${company.whatsapp}` : "", icon: <><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z" /><path d="M9 9.5c.5 2 2.5 4 4.5 4.5l1.2-1.2 2 .8v1.2c0 .4-.3.7-.7.7C11.5 15.4 8.6 12.5 8.4 8.7c0-.4.3-.7.7-.7h1.2l.8 2z" /></> },
  { name: "TikTok", href: company.tiktok, icon: <path d="M15 3v11.5a4.5 4.5 0 1 1-4.5-4.5M15 3c.4 2.6 2.2 4.4 5 4.6" /> },
  { name: "YouTube", href: company.youtube, icon: <><path d="M22.5 6.4a2.8 2.8 0 0 0-1.9-2C18.9 4 12 4 12 4s-6.9 0-8.6.4a2.8 2.8 0 0 0-1.9 2A29 29 0 0 0 1 11.8a29 29 0 0 0 .5 5.3A2.8 2.8 0 0 0 3.4 19c1.7.5 8.6.5 8.6.5s6.9 0 8.6-.5a2.8 2.8 0 0 0 1.9-2 29 29 0 0 0 .5-5.2 29 29 0 0 0-.5-5.4z" /><path d="M9.75 15 15.5 11.75 9.75 8.5z" /></> },
];

/**
 * Selos de confiança no topo do rodapé (entrega, segurança, apoio, trocas).
 */
const trust: { t: string; d: string; href?: string; icon: ReactNode }[] = [
  { t: "Entrega rápida", d: "45 min na cidade · 1h 30 fora", icon: <path d={MOTO_PATH} /> },
  { t: "Compra segura", d: "Pague como preferir", icon: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-4" /></> },
  { t: "Apoio ao cliente", d: company.whatsapp ? "Atendimento por WhatsApp" : (company.hours || "Fale connosco"), href: company.whatsapp ? `https://wa.me/${company.whatsapp}` : "", icon: <><path d="M3 14v-2a9 9 0 0 1 18 0v2" /><path d="M21 15a2 2 0 0 1-2 2h-1v-6h1a2 2 0 0 1 2 2z" /><path d="M3 15a2 2 0 0 0 2 2h1v-6H5a2 2 0 0 0-2 2z" /></> },
  { t: "Trocas e devoluções", d: "Produto com defeito? Ajudamos", icon: <path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5" /> },
];

/**
 * Rodapé do site: confiança, newsletter, contactos, colunas de links, pagamento e informação legal.
 */
function Footer({ s }: { s: Store }) {
  const [mail, setMail] = useState(""); const [done, setDone] = useState(false); const [bad, setBad] = useState(false);
  // Volta ao topo da página depois de navegar (o SPA não recarrega a página).
  const up = () => window.scrollTo({ top: 0 });
  // Navega para uma página; pedir "account" sem sessão leva ao login.
  const go = (p: Page) => { s.go(p === "account" && !s.user ? "auth" : p); up(); };
  // Abre a página de informações (Info) já no tópico pedido.
  // Nota: alguns títulos (ex.: "Ofertas", "FAQ") ainda não têm conteúdo em `topics`
  // (pages.tsx); nesses casos a página Info mostra "Sobre nós" como alternativa.
  const info = (t: string) => { s.setInfo(t); s.go("info"); up(); };
  const about = () => { s.go("about"); up(); };
  // Validação simples do e-mail com expressão regular (algo@dominio.ext).
  // A subscrição é apenas simulada; não envia dados para nenhum servidor.
  const subscribe = () => { const ok = /^\S+@\S+\.\S+$/.test(mail.trim()); setBad(!ok); setDone(ok); };

  // As colunas de links são definidas como dados e desenhadas com .map() — fácil de editar sem tocar no JSX.
  const cols: { title: string; links: [string, () => void][] }[] = [
    { title: "Produtos", links: [["Produtos", () => go("home")], ["Categorias", () => go("categories")], ["Ofertas", () => s.goShelf("ofertas")], ["Novidades", () => s.goShelf("novidades")]] },
    { title: "Ajuda", links: [["Contacto", () => info("Contacto")], ["Entregas", () => info("Entregas")], ["Trocas e devoluções", () => info("Trocas e devoluções")], ["FAQ", () => info("FAQ")], ["Sobre nós", about]] },
    { title: "Conta", links: [["Minha conta", () => go("account")], ["Meus pedidos", () => { if (s.user) { s.openAccount("Pedidos"); up(); } else go("account"); }], ["Lista de desejos", () => go("wishlist")]] },
  ];

  return (
    <footer>
      <div className="ft-wrap">
        {/* Faixa de selos de confiança. */}
        <div className="ft-trust">
          {trust.map((x) => (
            x.href
              ? <a key={x.t} className="ft-trust-link" href={x.href} target="_blank" rel="noopener noreferrer"><Ico size={30}>{x.icon}</Ico><span><strong>{x.t}</strong><small>{x.d}</small></span></a>
              : <div key={x.t}><Ico size={30}>{x.icon}</Ico><span><strong>{x.t}</strong><small>{x.d}</small></span></div>
          ))}
        </div>

        {/* Newsletter: mostra confirmação após subscrever ou erro se o e-mail for inválido. */}
        <div className="ft-news">
          <div><h4>Receba ofertas em primeira mão</h4><small>Subscreva a newsletter e não perca promoções e novidades.</small></div>
          {done ? <p className="ft-ok" role="status">Subscrição registada. Obrigado!</p> : (
            <div className="ft-sub">
              <input type="email" maxLength={254} value={mail} autoComplete="email" aria-label="E-mail para newsletter" aria-invalid={bad}
                onChange={(e) => { setMail(e.target.value); setBad(false); }} onKeyDown={(e) => e.key === "Enter" && subscribe()} />
              <button className="btn" onClick={subscribe}>Subscrever</button>
              {bad && <span className="ft-err" role="alert">Introduza um e-mail válido (nome@dominio.com).</span>}
            </div>
          )}
        </div>

        {/* Grelha principal: marca + contactos + redes sociais, e as colunas de navegação. */}
        <div className="ft-grid">
          <div className="ft-brand">
            <span className="ft-kicker">COMPRE COM CONFIANÇA</span>
            <button className="logo" onClick={() => go("home")}>Nhonga<span>Express</span></button>
            <p>Acessórios e tecnologia para o seu dia a dia, com entrega rápida.</p>
            <ul className="ft-contact">
              {company.phone && <li><Ico><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" /></Ico><a href={`tel:${company.phone.replace(/\s/g, "")}`}>{company.phone}</a></li>}
              {company.whatsapp && <li><Ico><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z" /><path d="M9 9.5c.5 2 2.5 4 4.5 4.5l1.2-1.2 2 .8v1.2c0 .4-.3.7-.7.7C11.5 15.4 8.6 12.5 8.4 8.7c0-.4.3-.7.7-.7h1.2l.8 2z" /></Ico><a href={`https://wa.me/${company.whatsapp}`} target="_blank" rel="noopener noreferrer">WhatsApp</a></li>}
              {company.email && <li><Ico><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-10 6L2 7" /></Ico><a href={`mailto:${company.email}`}>{company.email}</a></li>}
              {company.address && <li><Ico><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></Ico><span>{company.address}</span></li>}
              {company.hours && <li><Ico><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></Ico><span>{company.hours}</span></li>}
            </ul>
            <div className="social" aria-label="Redes sociais">
              {socials.filter((x) => x.href).map((x) => (
                <a key={x.name} href={x.href} target="_blank" rel="noopener noreferrer" aria-label={x.name} title={x.name}><Ico size={20}>{x.icon}</Ico></a>
              ))}
            </div>
          </div>
          {cols.map((c) => (
            <nav key={c.title} aria-label={c.title}>
              <h4>{c.title}</h4>
              <ul>{c.links.map(([t, fn]) => <li key={t}><button onClick={fn}>{t}</button></li>)}</ul>
            </nav>
          ))}
        </div>

        {/* Resumo das formas de pagamento e de entrega. */}
        <div className="ft-pay">
          <div><h4>Formas de pagamento</h4><div className="pills"><span className="pay-chip"><MpesaIcon height={48} /></span><span className="pay-chip"><EmolaIcon height={48} /></span><span className="pay-chip"><CashOnDeliveryIcon height={48} /></span></div></div>
          <div><h4>Entrega</h4><div className="pills"><span>Dentro da cidade • 45 min</span><span>Fora da cidade • 1h 30 min</span></div></div>
        </div>

        {/* Linha final: direitos de autor, links legais e botão "Topo" com scroll suave. */}
        <div className="ft-bottom">
          <p>© 2026 NhongaExpress. Todos os direitos reservados.</p>
          <div className="ft-legal">
            <button onClick={() => info("Termos de uso")}>Termos de uso</button>
            <button onClick={() => info("Política de privacidade")}>Privacidade</button>            <button onClick={openCookieSettings}>Cookies</button>
            <button className="ft-top" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} aria-label="Voltar ao topo"><Ico><path d="M12 19V5M5 12l7-7 7 7" /></Ico> Topo</button>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ========================================================================== */
/* 2. PÁGINAS E TIPOS                                                         */
/* ========================================================================== */

/**
 * Todas as "páginas" possíveis. É um tipo união: o TypeScript impede navegar
 * para uma página que não existe (ex.: go("carrinho") dá erro de compilação).
 */
type Page = "auth" | "home" | "categories" | "search" | "wishlist" | "account" | "cart" | "checkout" | "info" | "about" | "product";
/* ---- Endereço (#/pagina/argumento) <-> página atual ----
   O endereço guarda onde o utilizador está; ao atualizar a página (F5) a loja volta exatamente ao mesmo sítio.
   Exemplos: #/home/novidades · #/product/123 · #/info/FAQ · #/account/Moradas · #/search/fones */
const PAGE_LIST: Page[] = ["auth", "home", "categories", "search", "wishlist", "account", "cart", "checkout", "info", "about", "product"];
const readRoute = (): { page: Page; arg: string } => {
  const raw = window.location.hash.replace(/^#\/?/, "");
  const [p, ...rest] = raw.split("/");
  const page = (PAGE_LIST as string[]).includes(p) ? (p as Page) : "home";
  let arg = "";
  try { arg = decodeURIComponent(rest.join("/")); } catch { arg = ""; }
  return { page, arg };
};
const buildHash = (page: Page, arg: string) => `#/${page}${arg ? "/" + encodeURIComponent(arg) : ""}`;
/** Normaliza o título de uma vitrine: "Ofertas e promoções" -> "ofertas-e-promocoes". */
const shelfKey = (t: string) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
/** Palavras que identificam cada vitrine da página inicial (o rodapé aponta para elas). */
const SHELF_ALIASES: Record<string, string[]> = {
  ofertas: ["ofertas", "promo", "offer", "deal", "sale", "desconto"],
  novidades: ["novidades", "novo", "new", "lancamento", "arrival"],
};
const Blank = () => null;

/**
 * Contrato do estado partilhado. O App cria este objeto e entrega-o a cada página (prop `s`),
 * para que todas leiam o carrinho/favoritos e chamem as mesmas ações (add, toggle, go...).
 */
type Store = {
  q: string; setQ: (v: string) => void; cart: Record<string, number>; wish: string[]; user: boolean;
  /** Dados da conta autenticada (null se não houver sessão ou se o login foi o social simulado). */
  profile: ApiUser | null; setProfile: (u: ApiUser | null) => void;
  add: (id: string, d?: number) => void; toggle: (id: string) => void;
  /** Esvazia o carrinho (usado quando o pedido é criado com sucesso). */
  clearCart: () => void;
  go: (p: Page) => void; setUser: (v: boolean) => void;
  /** Vai para a página inicial e desce até uma vitrine ("ofertas" ou "novidades"). */
  goShelf: (key: string) => void;
  /** Vitrine pedida (chave) e um contador que muda a cada pedido, para voltar a descer mesmo sendo a mesma. */
  homeJump: { key: string; n: number };
  /** Guarda a secção da conta aberta (para a atualização da página voltar à mesma secção). */
  setAccountSec: (sec: string) => void;
  info: string; setInfo: (t: string) => void;
  selectedProductId: string | null; openProduct: (id: string) => void;
  showToast: (message: string) => void;
  /** Secção da área de conta a mostrar (muda quando o utilizador escolhe uma opção no sino do cabeçalho). */
  accountTarget: { sec: string; orderId?: string; focus?: string };
  /** Abre a área de conta já posicionada numa secção (ex.: "Moradas"). */
  openAccount: (sec: string, orderId?: string, focus?: string) => void;
  /** Pedidos do cliente (mais recentes primeiro), com o estado de cada um. */
  orders: ApiOrder[];
  /** Volta a pedir os pedidos ao servidor (nunca lança erro). */
  refreshOrders: () => Promise<void>;
  /** Junta um pedido recém-criado à lista (o sino e a página Pedidos atualizam logo). */
  addOrder: (o: ApiOrder) => void;
  /** Substitui um pedido já existente (ex.: depois de o cliente o cancelar). */
  updateOrder: (o: ApiOrder) => void;
  /** Tira um pedido da lista (depois de o cliente o eliminar). */
  removeOrder: (id: string) => void;
  /** Moradas guardadas na conta (a padrão primeiro) e preferências (pagamento padrão, avisos). */
  addresses: ApiAddress[]; setAddresses: (a: ApiAddress[]) => void;
  settings: ApiSettings; setSettings: (v: ApiSettings) => void;
  /** true quando moradas e preferências já foram pedidas ao servidor. */
  accountLoaded: boolean;
  welcomeVisible: boolean;
  dismissWelcome: () => void;
};
/** Produto tal como a API o devolve (/api/products e /api/home). */
type ApiProductRow = { id: string; name: string; description: string; price: number; category: string; image: string; images?: string[]; specs?: unknown; stock: number; active: boolean };
/** Especificação do produto definida no painel (ex.: "Bateria" → "30 horas"). */
type ProductSpec = { label: string; value: string };
/** Aceita a lista vinda da API (array, ou texto JSON) e devolve só linhas válidas. */
const normalizeSpecs = (raw: unknown): ProductSpec[] => {
  let list: unknown = raw;
  if (typeof list === "string") { try { list = JSON.parse(list); } catch { return []; } }
  if (!Array.isArray(list)) return [];
  return list
    .map((x) => ({ label: String((x as ProductSpec)?.label ?? "").trim(), value: String((x as ProductSpec)?.value ?? "").trim() }))
    .filter((x) => x.label && x.value);
};
/** Produto da loja + fotos extra da galeria (a principal continua em `image`) + especificações. */
type StoreProduct = Product & { images?: string[]; specs?: ProductSpec[] };
/** Converte um produto da API para o formato usado na loja. */
const toStoreProduct = (p: ApiProductRow): Product => ({
  id: p.id, name: p.name, group: p.category, cat: p.category, price: p.price,
  description: p.description, image: p.image, images: p.images ?? [], specs: normalizeSpecs(p.specs), stock: p.stock, active: p.active, available: p.stock > 0 && p.active,
} as StoreProduct);
/** O que a página inicial recebe de GET /api/home: produto em destaque + vitrines configuradas no painel. */
type HomeData = { featured: ApiProductRow | null; sections: { slug: string; title: string; products: ApiProductRow[] }[] };
const API_BASE = import.meta.env.VITE_API_URL ?? "";

/**
 * Procura um produto pelo id. O `!` afirma ao TypeScript que o id existe sempre no catálogo.
 */
const byId = (id: string) => products.find((p) => p.id === id)!;
/**
 * Total do carrinho: soma preço × quantidade de cada linha.
 */
const cartTotal = (cart: Record<string, number>) =>
  Object.entries(cart).reduce((t, [id, q]) => { const p = byId(id); return t + (p?.price ?? 0) * q; }, 0);

/**
 * Persistência do carrinho: guardado no localStorage para sobreviver a atualizações da página.
 * Só guarda { idDoProduto: quantidade }; nome, preço e imagem vêm sempre do catálogo.
 */
const CART_KEY = "nhongaexpress:cart";
const loadCart = (): Record<string, number> => {
  try {
    const raw = JSON.parse(localStorage.getItem(CART_KEY) || "{}");
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    // Mantém apenas quantidades válidas (inteiros positivos).
    return Object.fromEntries(Object.entries(raw).filter(([, q]) => Number.isInteger(q) && (q as number) > 0)) as Record<string, number>;
  } catch { return {}; }
};
const saveCart = (cart: Record<string, number>) => {
  try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch { /* modo privado / quota cheia: ignora */ }
};

/** Persistência da lista de desejos: favoritos sobrevivem a atualizações da página. */
const WISH_KEY = "nhongaexpress:wishlist";
const loadWish = (): string[] => {
  try {
    const raw = JSON.parse(localStorage.getItem(WISH_KEY) || "[]");
    return Array.isArray(raw) ? raw.filter((id): id is string => typeof id === "string") : [];
  } catch { return []; }
};
const saveWish = (wish: string[]) => {
  try { localStorage.setItem(WISH_KEY, JSON.stringify(wish)); } catch { /* ignora */ }
};

/**
 * Estado de ecrã que sobrevive à atualização da página (F5): categoria escolhida, filtros, passo do checkout...
 * Fica no sessionStorage (só neste separador) e é apagado ao terminar a sessão (clearUiDrafts).
 */
const UI_PREFIX = "nx_ui:";
const readUi = <T,>(key: string, initial: T): T => {
  try { const v = sessionStorage.getItem(UI_PREFIX + key); return v === null ? initial : (JSON.parse(v) as T); } catch { return initial; }
};
const usePersistedState = <T,>(key: string, initial: T) => {
  const [value, setValue] = useState<T>(() => readUi(key, initial));
  useEffect(() => { try { sessionStorage.setItem(UI_PREFIX + key, JSON.stringify(value)); } catch { /* ignora */ } }, [key, value]);
  return [value, setValue] as const;
};
const clearUiDrafts = (prefix = "") => {
  try { Object.keys(sessionStorage).filter((k) => k.startsWith(UI_PREFIX + prefix)).forEach((k) => sessionStorage.removeItem(k)); } catch { /* ignora */ }
};

/* -------------------------------------------------------------------------- */
/* Ícone SVG do favorito                                                       */
/* -------------------------------------------------------------------------- */
/* Utilizamos SVG em vez de caracteres ou emojis para manter o visual
   consistente em diferentes sistemas operativos e navegadores. */
const FavoriteIcon = ({ active }: { active: boolean }) => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill={active ? "currentColor" : "none"}
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M20.8 8.8c0 5.5-8.8 10.2-8.8 10.2S3.2 14.3 3.2 8.8A4.8 4.8 0 0 1 12 6.2a4.8 4.8 0 0 1 8.8 2.6Z" />
  </svg>
);

/* -------------------------------------------------------------------------- */
/* Cartão de produto                                                           */
/* -------------------------------------------------------------------------- */
/* Este componente concentra a apresentação de cada produto. A estrutura
   foi mantida compatível com os dados atuais do projeto. */
/**
 * Cartão de produto reutilizado em toda a loja.
 */
const Card = ({ p, s }: { p: Product; s: Store }) => {
  // O cartão inteiro é clicável (abre o detalhe). Os botões internos chamam e.stopPropagation()
  // para não disparar também o clique do cartão. Também funciona com Enter (teclado).
  const favorite = s.wish.includes(p.id);

  return (
    <article className="card product-card" tabIndex={0} onClick={() => s.openProduct(p.id)} onKeyDown={(e) => e.key === "Enter" && s.openProduct(p.id)}>
      {/* Imagem grande no topo, a ocupar toda a largura do cartão. */}
      <div className="product-media">
        {p.image ? <img src={p.image} alt={p.name} loading="lazy" /> : <span className="product-initial" aria-hidden="true">{p.name.charAt(0).toUpperCase()}</span>}

        {/* Favorito sobre a imagem. */}
        <button
          type="button"
          className={"product-favorite" + (favorite ? " on" : "")}
          aria-label={favorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
          aria-pressed={favorite}
          title={favorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
          onClick={(e) => { e.stopPropagation(); s.toggle(p.id); s.showToast(favorite ? "Removido dos favoritos" : "Adicionado aos favoritos"); }}
        >
          <FavoriteIcon active={favorite} />
        </button>
      </div>

      <div className="product-content">
        {/* Título em até 2 linhas, terminando em "…". */}
        <h4 className="product-name">{p.name}</h4>

        {/* Linha de destaque do grupo do produto. */}
        <p className="product-meta">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 5 5L20 7" /></svg>
          <span>{p.group}</span>
        </p>

        {/* Preço em destaque. */}
        <div className="product-price-row">
          <strong className="product-price">{fmt(p.price)}</strong>
        </div>

        {/* Linha final em cinza: subcategoria (omitida quando repete o grupo, para poupar altura). */}
        {p.cat && p.cat !== p.group && <p className="product-sub">{p.cat}</p>}

        {/* Botão "Adicionar ao carrinho" com ícone de carrinho (largura total do cartão). */}
        <button
          type="button"
          className="product-add-btn"
          aria-label={`Adicionar ${p.name} ao carrinho`}
          onClick={(e) => { e.stopPropagation(); s.add(p.id); s.showToast("Produto adicionado ao carrinho"); }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6" /></svg>
          <span>Adicionar ao carrinho</span>
        </button>
      </div>
    </article>
  );
};

/**
 * Cabeçalho de cada secção da página inicial: título à esquerda e "Ver mais" à direita.
 * "Ver mais" abre a página de categorias, onde se vê todo o catálogo.
 */
const ShelfHead = ({ title, s }: { title: string; s: Store }) => (
  <div className="shelf-head">
    <h2>{title}</h2>
    <button type="button" className="shelf-more" onClick={() => s.go("categories")} aria-label={`Ver mais em ${title}`}>
      Ver mais
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
    </button>
  </div>
);
/**
 * Grelha de cartões de produto; se a lista estiver vazia mostra uma mensagem em vez de ficar em branco.
 */
const Grid = ({ list, s }: { list: Product[]; s: Store }) =>
  list.length ? <div className="grid">{list.map((p) => <Card key={p.id} p={p} s={s} />)}</div> : <p className="muted">Nada por aqui ainda.</p>;

/**
 * Logótipo usado no botão de login com Google (SVG embutido, sem pedidos de rede).
 */
const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" /><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.6z" /><path fill="#FBBC05" d="M10.5 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.9-6.1z" /><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" /></svg>
);

// As três vistas do ecrã de autenticação.
type AuthMode = "Entrar" | "Registar" | "Recuperar";
const TERMS_MSG = "Aceite os Termos de uso e a Política de privacidade para continuar.";

/* ========================================================================== */
/* TIPOS DE VARIÁVEL E DE DADOS DOS CAMPOS DOS FORMULÁRIOS                    */
/* ========================================================================== */
/* Cada campo declara: (1) o tipo TypeScript da variável, (2) o tipo de dados que o
   utilizador pode escrever e (3) o atributo HTML que o impõe (ver FIELD abaixo).
   O servidor volta a validar tudo. */

/** Registo e login. */
type AuthForm = {
  name: string;  // texto: só letras, espaços, apóstrofo e hífen (máx. 80). Sem números nem símbolos.
  id: string;    // texto (só no login): e-mail (nome@dominio.com) OU telefone de 9 dígitos (máx. 254).
  email: string; // OBRIGATÓRIO no registo. Texto no formato de e-mail: nome@dominio.com (máx. 254).
  phone: string; // OBRIGATÓRIO no registo. Texto só com DÍGITOS (0–9): exatamente 9, a começar por 82–87. Sem +258, espaços nem letras.
  pw: string;    // texto: 8 a 128 caracteres, com letras e pelo menos 1 número.
  pw2: string;   // texto: igual a `pw`.
};
/** Perfil do cliente (mesmas regras do registo). */
type ProfileForm = { name: string; email: string; phone: string };
/** Alterar palavra-passe: três textos (atual, nova, confirmação da nova). */
type PasswordForm = { cur: string; next: string; next2: string };

/** Atributos HTML que impõem o tipo de dados de cada campo. */
const FIELD: Record<"name" | "email" | "phone" | "code" | "contact", InputHTMLAttributes<HTMLInputElement>> = {
  name: { type: "text", autoComplete: "name", maxLength: 80 },
  email: { type: "email", inputMode: "email", autoComplete: "email", maxLength: 254 },
  phone: { type: "tel", inputMode: "numeric", autoComplete: "tel-national", maxLength: 9, pattern: "[0-9]{9}" },
  code: { type: "text", inputMode: "numeric", autoComplete: "one-time-code", maxLength: 6, pattern: "[0-9]{6}" },
  contact: { type: "text", autoComplete: "username", maxLength: 254 }, // e-mail ou telefone (login/recuperar)
};

// Filtros aplicados enquanto o utilizador escreve: o que não é permitido nem chega a aparecer no campo.
const onlyDigits = (v: string, max: number) => v.replace(/\D/g, "").slice(0, max);
// Telefone: só dígitos, máx. 9. Se colarem "+258 84 123 4567", o prefixo +258 é descartado.
const onlyPhone = (v: string) => { const d = v.replace(/\D/g, ""); return (d.length > 9 && d.startsWith("258") ? d.slice(3) : d).slice(0, 9); };
const onlyName = (v: string) => v.replace(/[\d_@#$%^&*()+=[\]{}|\\<>/?~`!:;,"]/g, "").slice(0, 80);

// Filtros dos campos de morada (checkout e "Minhas moradas"): o que não é permitido nem chega a aparecer.
// Nome de quem recebe: só letras (com acentos), espaços, apóstrofo e hífen.
const onlyPersonName = (v: string) => v.replace(/[^\p{L}\s'’-]/gu, "").replace(/^\s+/, "").replace(/\s{2,}/g, " ").slice(0, 50);
// Localidade/distrito: letras, números, espaços, apóstrofo, ponto e hífen.
const onlyPlace = (v: string) => v.replace(/[^\p{L}\d\s'’.-]/gu, "").replace(/^\s+/, "").replace(/\s{2,}/g, " ").slice(0, 50);
// Rua/avenida e ponto de referência: letras, números, espaços e . , - / º ª ' (ex.: "Av. Eduardo Mondlane, 120").
const onlyAddressText = (v: string, max: number) => v.replace(/[^\p{L}\d\s.,\-/ºª'’]/gu, "").replace(/^\s+/, "").replace(/\s{2,}/g, " ").slice(0, max);
const PERSON_NAME_RE = /^\p{L}[\p{L}\s'’-]*$/u;
const PLACE_RE = /^[\p{L}\d\s'’.-]+$/u;
const ADDRESS_TEXT_RE = /^[\p{L}\d\s.,\-/ºª'’]+$/u;
const HAS_LETTER_RE = /\p{L}/u;

// Regras de formato (validação ao submeter).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/; // nome@dominio.com
const PHONE_RE = /^8[2-7]\d{7}$/;                   // 9 dígitos: 82–87 + 7 dígitos
// "841234567" -> "+258841234567" (formato guardado); vazio continua vazio.
const normPhone = (digits: string) => (digits ? "+258" + digits : "");

/**
 * Recuperar palavra-passe, em 2 passos:
 *  1) "ask":  o cliente indica o e-mail da conta e o servidor envia um código de 6 dígitos
 *             (a resposta é sempre a mesma, exista a conta ou não).
 *  2) "code": o cliente escreve o código e a nova palavra-passe. O código vale 15 minutos,
 *             é de uso único e deixa de servir após 5 tentativas erradas.
 * No fim volta ao ecrã "Entrar" com o contacto já preenchido.
 */
/** Logotipo mostrado no topo dos formulários de autenticação (mesmo estilo do login). */
const AuthLogo = () => (
  <div className="auth-mobile-logo" aria-label="NhongaExpress">
    <img src="/favicon.svg" alt="" className="auth-brand-mark" />
    <span>Nhonga<span>Express</span></span>
  </div>
);

const Recover = ({ s, initialId, onBack, onDone }: { s: Store; initialId: string; onBack: () => void; onDone: (id: string) => void }) => {
  const [step, setStep] = useState<"ask" | "code">("ask");
  const [id, setId] = useState(EMAIL_RE.test(initialId.trim()) ? initialId.trim() : ""); // só e-mail (um telefone escrito no login é ignorado)
  const [code, setCode] = useState("");
  const [pw, setPw] = useState({ next: "", next2: "" });
  const [show, setShow] = useState(false);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  // Segundos até se poder pedir novo código (o servidor também impõe 1 minuto entre pedidos).
  const [wait, setWait] = useState(0);
  useEffect(() => {
    if (wait <= 0) return;
    const t = window.setTimeout(() => setWait(wait - 1), 1000);
    return () => window.clearTimeout(t);
  }, [wait]);

  // Passo 1 (e reenvio): pede o código ao servidor.
  const ask = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!id.trim()) return setErrs({ id: "Insira o seu e-mail." });
    if (!EMAIL_RE.test(id.trim())) return setErrs({ id: "Insira um e-mail válido." });
    setBusy(true); setErrs({}); setMsg("");
    try {
      await api.forgotPassword({ identifier: id.trim() });
      setStep("code"); setWait(60); setCode("");
    } catch (error) {
      if (error instanceof ApiError && error.fields?.identifier) setErrs({ id: error.fields.identifier });
      else setMsg(error instanceof ApiError ? error.message : "Ocorreu um erro. Tente novamente.");
    } finally { setBusy(false); }
  };

  // Passo 2: valida no cliente e envia código + nova palavra-passe (o servidor valida tudo outra vez).
  const reset = async (e: FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!/^\d{6}$/.test(code.trim())) next.code = "Insira o código de 6 dígitos.";
    if (pw.next.length < 8) next.next = "Use pelo menos 8 caracteres.";
    else if (!(/[A-Za-z]/.test(pw.next) && /\d/.test(pw.next))) next.next = "Use letras e pelo menos um número.";
    if (pw.next !== pw.next2) next.next2 = "As palavras-passe não coincidem.";
    setErrs(next); setMsg("");
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      await api.resetPassword({ identifier: id.trim(), code: code.trim(), newPassword: pw.next });
      s.showToast("Palavra-passe alterada. Já pode entrar.");
      onDone(id.trim());
    } catch (error) {
      if (error instanceof ApiError && error.fields) setErrs({ code: error.fields.code ?? "", next: error.fields.newPassword ?? "" });
      else setMsg(error instanceof ApiError ? error.message : "Ocorreu um erro. Tente novamente.");
    } finally { setBusy(false); }
  };

  if (step === "ask") {
    return (
      <form className="panel narrow auth" onSubmit={ask} noValidate>
        <AuthLogo />
        <h2>Recuperar palavra-passe</h2>
        <p className="muted">Indique o e-mail da sua conta e enviaremos um código de 6 dígitos para esse e-mail, para criar uma nova palavra-passe.</p>
        <div className="field"><label htmlFor="rec-id">E-mail</label><input id="rec-id" {...FIELD.email} value={id} onChange={(e) => { setId(e.target.value); setErrs({}); setMsg(""); }} aria-invalid={!!errs.id} />{errs.id && <small className="field-error">{errs.id}</small>}</div>
        {msg && <p className="auth-err" role="alert">{msg}</p>}
        <button type="submit" className="btn full" disabled={busy}>{busy ? "A enviar..." : "Enviar código"}</button>
        <button type="button" className="link auth-link" onClick={onBack}>Voltar a Entrar</button>
      </form>
    );
  }

  return (
    <form className="panel narrow auth" onSubmit={reset} noValidate>
      <AuthLogo />
      <h2>Nova palavra-passe</h2>
      <p className="auth-ok" role="status">Se existir uma conta com o e-mail <b>{id.trim()}</b>, enviámos um código de 6 dígitos para a caixa de correio (veja também a pasta de spam). Vale 15 minutos.</p>
      <div className="field"><label htmlFor="rec-code">Código de 6 dígitos</label><input id="rec-code" {...FIELD.code} value={code} onChange={(e) => { setCode(onlyDigits(e.target.value, 6)); setErrs({ ...errs, code: "" }); setMsg(""); }} aria-invalid={!!errs.code} />{errs.code && <small className="field-error">{errs.code}</small>}</div>
      <div className="field"><label htmlFor="rec-pw">Nova palavra-passe</label>
        <div className="pw"><input id="rec-pw" maxLength={128} type={show ? "text" : "password"} autoComplete="new-password" value={pw.next} onChange={(e) => { setPw({ ...pw, next: e.target.value }); setErrs({ ...errs, next: "" }); }} aria-invalid={!!errs.next} /><button type="button" className="pw-toggle" aria-label={show ? "Ocultar palavra-passe" : "Mostrar palavra-passe"} onClick={() => setShow(!show)}>{show ? "◉" : "◌"}</button></div>
        {errs.next && <small className="field-error">{errs.next}</small>}
      </div>
      <div className="field"><label htmlFor="rec-pw2">Confirmar nova palavra-passe</label><input id="rec-pw2" maxLength={128} type={show ? "text" : "password"} autoComplete="new-password" value={pw.next2} onChange={(e) => { setPw({ ...pw, next2: e.target.value }); setErrs({ ...errs, next2: "" }); }} aria-invalid={!!errs.next2} />{errs.next2 && <small className="field-error">{errs.next2}</small>}</div>
      {msg && <p className="auth-err" role="alert">{msg}</p>}
      <button type="submit" className="btn full" disabled={busy}>{busy ? "A guardar..." : "Guardar nova palavra-passe"}</button>
      <button type="button" className="link auth-link" disabled={busy || wait > 0} onClick={() => ask()}>{wait > 0 ? `Reenviar código (${wait}s)` : "Reenviar código"}</button>
      <button type="button" className="link auth-link" onClick={() => { setStep("ask"); setErrs({}); setMsg(""); }}>Usar outro e-mail</button>
      <button type="button" className="link auth-link" onClick={onBack}>Voltar a Entrar</button>
    </form>
  );
};

/**
 * Ecrã de autenticação: entrar, registar e recuperar palavra-passe.
 * - Validação feita no cliente, campo a campo, com mensagens de erro acessíveis (aria-invalid).
 * - Registo e login falam com o backend real (`api.register` / `api.login`, ver src/api.ts):
 *   a palavra-passe é validada e guardada com hash no servidor e a sessão fica num cookie httpOnly.
 * - O botão "Continuar com Google" faz login real (ver src/services/social.ts): o token do Google
 *   é enviado ao backend, que o valida e abre a sessão (cookie httpOnly), tal como no login normal.
 */
/** Conta criada há menos de 2 minutos = utilizador novo (usado no login Google, onde o registo é automático). */
const isNewAccount = (u: ApiUser) => Date.now() - new Date(u.createdAt).getTime() < 2 * 60 * 1000;

const Auth = ({ s }: { s: Store }) => {
  const [mode, setMode] = useState<AuthMode>("Entrar");
  // Valores do formulário (nome, e-mail/telefone, palavra-passe e confirmação).
  const [f, setF] = useState<AuthForm>({ name: "", id: "", email: "", phone: "", pw: "", pw2: "" });
  const [terms, setTerms] = useState(false);
  const [remember, setRemember] = useState(true);
  const [show, setShow] = useState(false);
  const [err, setErr] = useState("");
  // true enquanto o pedido ao servidor está em curso (evita cliques duplicados).
  const [loading, setLoading] = useState(false);
  // Erro por campo, para mostrar a mensagem junto ao input certo.
  const [fieldErrors, setFieldErrors] = useState<Record<string,string>>({});

  // Cria um onChange genérico para o campo `k` e limpa o erro desse campo ao escrever.
  const set = (k: keyof AuthForm, clean: (v: string) => string = (v) => v) => (e: ChangeEvent<HTMLInputElement>) => { setF({ ...f, [k]: clean(e.target.value) }); setErr(""); setFieldErrors({ ...fieldErrors, [k]: "" }); };
  const switchMode = (m: AuthMode) => { setMode(m); setErr(""); };
  // Marca o utilizador como autenticado e vai para a Home (usado após sucesso da API e nos botões sociais simulados).
  const enter = () => { s.setUser(true); s.go("home"); };
  const legal = (t: "Termos de uso" | "Política de privacidade") => { s.setInfo(t); s.go("info"); };
  // Passos comuns a qualquer login com sucesso (formulário ou social).
  // `isNew` = conta acabada de criar. Só nesse caso aparece o cartão de boas-vindas; quem apenas entra (login) não o vê.
  const finish = (user: ApiUser, okMsg: string, isNew = false) => {
    s.setProfile(user); // o ícone de perfil passa a mostrar os dados desta conta
    if (isNew) window.dispatchEvent(new CustomEvent("nx:show-welcome"));
    // Login único: se veio de /admin (?next=admin), o administrador segue direto para o painel.
    if (wantsAdmin()) {
      if (user.role === "admin") { window.location.assign(ADMIN_BASE); return; }
      clearNextParam();
      s.showToast("Esta conta não tem acesso ao painel administrativo.");
      enter();
      return;
    }
    s.showToast(okMsg);
    enter();
  };
  // Pré-carrega o SDK do Google para o popup abrir logo ao clicar (evita bloqueio do browser).
  useEffect(() => { preloadSocial(); }, []);
  // Login com Google: abre o popup do Google e o backend valida o token.
  const social = async (provider: SocialProvider) => {
    if (loading) return;
    if (mode === "Registar" && !terms) return setErr(TERMS_MSG);
    setErr("");
    setLoading(true);
    try {
      const user = await socialLogin(provider);
      // Google: o servidor cria a conta no primeiro acesso; só então é utilizador novo (conta criada há menos de 2 min).
      finish(user, "Sessão iniciada.", isNewAccount(user));
    } catch (error) {
      if (error instanceof SocialCancelled) return; // o utilizador fechou o popup: não é erro
      setErr(error instanceof Error ? error.message : "Ocorreu um erro. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };
  // Valida o formulário no cliente e depois pede ao servidor para criar a conta / iniciar sessão.
  // O servidor valida tudo outra vez (nunca confiar só no cliente) e devolve erros por campo.
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const next: Record<string,string> = {};
    const email = f.email.trim();
    const phone = normPhone(f.phone); // "+258XXXXXXXXX" ou ""
    if (!f.pw) next.pw = "Insira a sua palavra-passe.";
    if (mode === "Entrar") {
      if (!f.id.trim()) next.id = "Insira o seu e-mail ou telefone.";
    } else {
      if (f.name.trim().length < 2) next.name = "Insira o seu nome completo.";
      if (!email) next.email = "Insira o seu e-mail.";
      else if (!EMAIL_RE.test(email)) next.email = "E-mail inválido. Use o formato nome@dominio.com.";
      if (!f.phone) next.phone = "Insira o seu telefone.";
      else if (!PHONE_RE.test(f.phone)) next.phone = "Escreva 9 dígitos, a começar por 82–87.";
      if (f.pw && f.pw.length < 8) next.pw = "Use pelo menos 8 caracteres.";
      else if (f.pw && !(/[A-Za-z]/.test(f.pw) && /\d/.test(f.pw))) next.pw = "Use letras e pelo menos um número.";
      if (f.pw !== f.pw2) next.pw2 = "As palavras-passe não coincidem.";
      if (!terms) return setErr(TERMS_MSG);
    }
    setFieldErrors(next);
    if (Object.keys(next).length) return;
    if (!navigator.onLine) {
      setErr("Erro de ligação. Verifique a sua ligação à Internet e tente novamente.");
      return;
    }
    setLoading(true);
    try {
      let user: ApiUser;
      if (mode === "Registar") {
        // E-mail (é para onde vai o código de recuperação da palavra-passe) e telefone são obrigatórios.
        user = (await api.register({ name: f.name.trim(), email, phone, password: f.pw })).user;
      } else {
        user = (await api.login({ identifier: f.id.trim(), password: f.pw, remember })).user;
      }
      finish(user, mode === "Registar" ? "Conta criada com sucesso!" : "Sessão iniciada.", mode === "Registar");
    } catch (error) {
      if (error instanceof ApiError && error.status === 0) {
        setErr("Erro de ligação. Verifique a sua ligação à Internet e tente novamente.");
        setFieldErrors({});
      } else if (error instanceof ApiError && error.status === 401 && mode === "Entrar") {
        setErr("E-mail ou palavra-passe inválida.");
        setFieldErrors({});
      } else if (error instanceof ApiError && error.fields) {
        // Traduz os nomes dos campos da API para os do formulário (identifier -> id, password -> pw).
        setFieldErrors({
          name: error.fields.name ?? "",
          id: error.fields.identifier ?? "",
          email: error.fields.email ?? "",
          phone: error.fields.phone ?? "",
          pw: error.fields.password ?? "",
        });
      } else {
        setErr(error instanceof ApiError ? error.message : "Ocorreu um erro. Tente novamente.");
      }
    } finally {
      setLoading(false);
    }
  };
  // Medidor profissional: avalia comprimento, minúsculas/maiúsculas, números e símbolos.
  const passwordChecks = [
    f.pw.length >= 8,
    /[a-z]/.test(f.pw) && /[A-Z]/.test(f.pw),
    /\d/.test(f.pw),
    /[^A-Za-z0-9]/.test(f.pw),
  ];
  const passwordScore = passwordChecks.filter(Boolean).length;
  const strength = !f.pw ? "" : passwordScore <= 1 ? "Fraca" : passwordScore <= 2 ? "Média" : passwordScore === 3 ? "Boa" : "Forte";
  const LegalLinks = () => <><button type="button" className="link" onClick={() => legal("Termos de uso")}>Termos de uso</button> e a <button type="button" className="link" onClick={() => legal("Política de privacidade")}>Política de privacidade</button></>;

  // Recuperar palavra-passe: fluxo em 2 passos (pedir código -> código + nova palavra-passe).
  if (mode === "Recuperar") {
    return (
      <Recover
        s={s}
        initialId={f.id}
        onBack={() => switchMode("Entrar")}
        onDone={(id) => { setF({ name: "", id, email: "", phone: "", pw: "", pw2: "" }); setFieldErrors({}); switchMode("Entrar"); }}
      />
    );
  }

  // Atalho: true quando o formulário está em modo de registo.
  const reg = mode === "Registar";
  return (
    <div className="auth-layout auth-layout-form-only">
      <form className="panel auth" onSubmit={submit} noValidate>
        <div className="auth-mobile-logo" aria-label="NhongaExpress">
          <img src="/favicon.svg" alt="" className="auth-brand-mark" />
          <span>Nhonga<span>Express</span></span>
        </div>
        <div className="auth-head">
          <h2>{reg ? "Criar conta" : "Bem-vindo!"}</h2>
          <p className="muted">{reg ? "Crie a sua conta para comprar mais depressa." : "Entre na sua conta para continuar."}</p>
        </div>
        <div className="tabs" role="tablist">{(["Entrar", "Registar"] as const).map((m) => <button type="button" key={m} role="tab" aria-selected={mode === m} className={mode === m ? "on" : ""} onClick={() => switchMode(m)}>{m}</button>)}</div>
        {reg && <div className="field"><label htmlFor="au-name">Nome completo</label><input id="au-name" {...FIELD.name} value={f.name} onChange={set("name", onlyName)} aria-invalid={!!fieldErrors.name} />{fieldErrors.name && <small className="field-error">{fieldErrors.name}</small>}</div>}
        {!reg && <div className="field"><label htmlFor="au-id">E-mail ou telefone</label><input id="au-id" {...FIELD.contact} value={f.id} onChange={set("id")} aria-invalid={!!fieldErrors.id} />{fieldErrors.id && <small className="field-error">{fieldErrors.id}</small>}</div>}
        {reg && <div className="field"><label htmlFor="au-email">E-mail</label><input id="au-email" {...FIELD.email} value={f.email} onChange={set("email")} aria-invalid={!!fieldErrors.email} />{fieldErrors.email && <small className="field-error">{fieldErrors.email}</small>}</div>}
        {reg && <div className="field"><label htmlFor="au-phone">Telefone</label><input id="au-phone" {...FIELD.phone} value={f.phone} onChange={set("phone", onlyPhone)} aria-invalid={!!fieldErrors.phone} />{fieldErrors.phone && <small className="field-error">{fieldErrors.phone}</small>}</div>}
        <div className="field"><label htmlFor="au-pw">Palavra-passe</label>
          <div className="pw"><input id="au-pw" maxLength={128} type={show ? "text" : "password"} autoComplete={reg ? "new-password" : "current-password"} value={f.pw} onChange={set("pw")} aria-invalid={!!fieldErrors.pw} /><button type="button" className="pw-toggle" aria-label={show ? "Ocultar palavra-passe" : "Mostrar palavra-passe"} onClick={() => setShow(!show)}>{show ? "◉" : "◌"}</button></div>
          {fieldErrors.pw && <small className="field-error">{fieldErrors.pw}</small>}
          {reg && f.pw && (
            <div className={`strength strength-${passwordScore}`} aria-live="polite">
              <div className="strength-bars" aria-hidden="true">
                {[0, 1, 2, 3].map((i) => <span key={i} className={i < passwordScore ? "filled" : ""} />)}
              </div>
              <div className="strength-label"><b>{strength}</b><span>{passwordScore < 4 ? "Use letras maiúsculas, números e símbolos." : "Palavra-passe segura."}</span></div>
            </div>
          )}
        </div>
        {reg && <div className="field"><label htmlFor="au-pw2">Confirmar palavra-passe</label><input id="au-pw2" maxLength={128} type={show ? "text" : "password"} autoComplete="new-password" value={f.pw2} onChange={set("pw2")} aria-invalid={!!fieldErrors.pw2} />{fieldErrors.pw2 && <small className="field-error">{fieldErrors.pw2}</small>}</div>}
        {!reg && <div className="auth-opts"><button type="button" className="link" onClick={() => switchMode("Recuperar")}>Esqueceu a palavra-passe?</button><label className="check"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Manter sessão iniciada</label></div>}
        {reg && <label className="check terms"><input type="checkbox" checked={terms} onChange={(e) => { setTerms(e.target.checked); setErr(""); }} /><span>Li e aceito os <LegalLinks />.</span></label>}
        {err && <p className="auth-err" role="alert">{err}</p>}
        <button type="submit" className="btn full" disabled={loading}>{loading ? "A processar..." : reg ? "Criar conta" : "Entrar"}</button>
        <div className="auth-or" role="separator"><span>ou</span></div>
        <div className="social-auth"><button type="button" className="btn ghost social-btn" disabled={loading} onClick={() => social("google")}><GoogleIcon /><span>Continuar com Google</span></button></div>
        <button type="button" className="link auth-link guest" onClick={() => { s.setUser(false); s.setProfile(null); s.dismissWelcome(); s.go("home"); }}>Continuar como convidado</button>
        {!reg && <p className="auth-legal">Ao entrar, aceita os <LegalLinks />.</p>}
      </form>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* Ícones SVG das categorias                                                   */
/* -------------------------------------------------------------------------- */
/* Cada categoria recebe um ícone SVG simples e consistente. Não utilizamos
   emojis para evitar diferenças de aparência entre dispositivos. */
const catIcons: Record<string, JSX.Element> = {
  "Todas": (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </>
  ),

  "Acessórios para telemóveis": (
    <>
      <rect x="5" y="2" width="14" height="20" rx="2" />
      <path d="M9 5h6M11 18h2" />
    </>
  ),

  "Áudio": (
    <>
      <path d="M3 14v-2a9 9 0 0 1 18 0v2" />
      <path d="M21 15a2 2 0 0 1-2 2h-1v-6h1a2 2 0 0 1 2 2z" />
      <path d="M3 15a2 2 0 0 0 2 2h1v-6H5a2 2 0 0 0-2 2z" />
    </>
  ),

  "Computadores": (
    <>
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </>
  ),

  "Energia e carregamento": (
    <path d="M13 2 3 14h9l-1 8 10-12h-9z" />
  ),

  "Internet e conectividade": (
    <>
      <path d="M5 12.5a11 11 0 0 1 14 0" />
      <path d="M1.4 9a16 16 0 0 1 21.2 0" />
      <path d="M8.5 16.1a6 6 0 0 1 7 0" />
      <path d="M12 20h.01" />
    </>
  ),

  "Acessórios automóveis": (
    <>
      <path d="M3 13l2-6a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1l2 6v5H3z" />
      <path d="M3 13h18" />
      <circle cx="7.5" cy="16" r="1" />
      <circle cx="16.5" cy="16" r="1" />
    </>
  ),

  "Fotografia e vídeo": (
    <>
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </>
  ),

  "Gadgets": (
    <>
      <circle cx="12" cy="12" r="6" />
      <path d="M12 9v3l1.5 1.5M16.5 17.5 16 22H8l-.5-4.5M7.5 6.5 8 2h8l.5 4.5" />
    </>
  ),
};

/* -------------------------------------------------------------------------- */
/* Componente visual do ícone da categoria                                     */
/* -------------------------------------------------------------------------- */
/* O SVG mantém o mesmo tamanho, espessura e alinhamento em todos os cartões. */
const CatIcon = ({ name }: { name: string }) => {
  // 1) ícone escolhido no painel; 2) ícone antigo desta categoria; 3) ícone gerado a partir do nome.
  const key = storedIconKey(name) ?? (catIcons[name] ? null : suggestIconKey(name));
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {key ? ICON_LIBRARY[key].svg : catIcons[name]}
    </svg>
  );
};

/** Aplica as categorias vindas do painel (/api/categories) à lista da loja, mantendo as subcategorias que já existiam. */
const applyApiCategories = (rows: { name: string; icon: string }[]) => {
  const previous: Record<string, string[]> = { ...categories };
  for (const k of Object.keys(categories)) delete categories[k];
  for (const r of rows) categories[r.name] = previous[r.name] ?? [];
  setCategoryIcons(Object.fromEntries(rows.map((r) => [r.name, r.icon])));
};


/* -------------------------------------------------------------------------- */
/* MELHORIA 04 — PÁGINA PROFISSIONAL DE DETALHE DO PRODUTO                   */
/* -------------------------------------------------------------------------- */
/* Reutiliza os dados atuais do catálogo. A área visual fica preparada para
   receber imagens reais quando o catálogo dinâmico for ligado ao backend. */
// Página de detalhe: lê o produto escolhido em `s.selectedProductId`.
const ProductDetail = ({ s }: { s: Store }) => {
  // Fica `undefined` se nenhum produto estiver selecionado ou se o id não existir.
  const product = s.selectedProductId === null ? undefined : byId(s.selectedProductId);
  // Quantidade escolhida e imagem da galeria ativa (estados locais desta página).
  const [quantity, setQuantity] = useState(1);
  const [selectedView, setSelectedView] = useState(0);
  // Ao mudar de produto, volta à primeira foto.
  useEffect(() => { setSelectedView(0); }, [s.selectedProductId]);

  // Estado de erro: evita ecrã em branco se o produto não for encontrado.
  if (!product) {
    return (
      <section className="product-not-found">
        <h2>Produto não encontrado</h2>
        <p className="muted">O produto selecionado já não está disponível nesta sessão.</p>
        <button type="button" className="btn" onClick={() => s.go("home")}>Voltar à loja</button>
      </section>
    );
  }

  const favorite = s.wish.includes(product.id);
  // Galeria: foto principal + fotos extra definidas pelo administrador (sem repetidas nem vazias).
  const gallery = [...new Set([product.image, ...((product as StoreProduct).images ?? [])].filter(Boolean))];
  const view = Math.min(selectedView, Math.max(0, gallery.length - 1));
  const specs = (product as StoreProduct).specs ?? [];
  // Math.max(1, ...) impede quantidades menores que 1.
  const decrease = () => setQuantity((value) => Math.max(1, value - 1));
  const increase = () => setQuantity((value) => value + 1);
  // Adiciona a quantidade escolhida ao carrinho e leva o utilizador ao carrinho.
  const addProduct = () => {
    s.add(product.id, quantity);
    s.showToast("Produto adicionado ao carrinho");
    s.go("cart");
  };

  // Benefícios da loja. Renderizado em dois sítios (o CSS mostra só um): por baixo da imagem no computador e no bloco de compra no telemóvel.
  const renderBenefits = (cls: string) => (
    <div className={"product-benefits " + cls}>
              <div className="product-benefit">
                <span className="benefit-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d={MOTO_PATH} />
                  </svg>
                </span>
                <div><strong>Entrega rápida</strong><small>45 minutos na cidade, 1 hora e 30 minutos fora.</small></div>
              </div>
  
              <div className="product-benefit">
                <span className="benefit-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v6h-6" />
                  </svg>
                </span>
                <div><strong>Compra segura</strong><small>Pagamento e pedido acompanhados no checkout.</small></div>
              </div>
  
              <div className="product-benefit">
                <span className="benefit-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 7h-9M20 12H4M20 17H8" />
                    <path d="m4 4-2 3 2 3" />
                  </svg>
                </span>
                <div><strong>Categoria verificada</strong><small>{product.cat}</small></div>
              </div>
    </div>
  );

  return (
    <section className="product-detail" aria-label={`Detalhes de ${product.name}`}>
      {/* Caminho de navegação contextual. */}
      <div className="product-breadcrumb">
        <button type="button" className="link" onClick={() => s.go("home")}>Início</button>
        <span aria-hidden="true">/</span>
        <button type="button" className="link" onClick={() => s.go("categories")}>{product.group}</button>
        <span aria-hidden="true">/</span>
        <strong>{product.name}</strong>
      </div>

      <div className={"product-detail-grid" + (specs.length > 0 ? " has-specs" : "")}>
        {/* Galeria principal do produto. */}
        <div className="product-gallery">
          <div className="product-main-image">
            <div className="product-detail-placeholder" aria-hidden="true">
              {gallery[view] ? <img src={gallery[view]} alt="" /> : <span>{product.name.charAt(0).toUpperCase()}</span>}
            </div>

            {/* Favorito em destaque sobre a imagem. */}
            <button
              type="button"
              className={"product-detail-favorite" + (favorite ? " on" : "")}
              aria-label={favorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
              aria-pressed={favorite}
              title={favorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
              onClick={() => { s.toggle(product.id); s.showToast(favorite ? "Removido dos favoritos" : "Adicionado aos favoritos"); }}
            >
              <FavoriteIcon active={favorite} />
            </button>
          </div>

          {/* Miniaturas: só aparecem quando o produto tem mais do que uma foto. */}
          {gallery.length > 1 && (
            <div className="product-thumbnails" role="group" aria-label="Fotos do produto">
              {gallery.map((url, i) => (
                <button
                  type="button"
                  key={url}
                  className={"product-thumbnail" + (view === i ? " on" : "")}
                  aria-label={`Ver foto ${i + 1}`}
                  aria-pressed={view === i}
                  onClick={() => setSelectedView(i)}
                >
                  <img src={url} alt="" aria-hidden="true" />
                </button>
              ))}
            </div>
          )}

          {/* Benefícios: versão do computador, em linha por baixo do cartão da imagem. */}
          {renderBenefits("benefits-desktop")}
        </div>

        {/* Informações comerciais e ações de compra. */}
        <div className="product-detail-info">
          {/* Resumo: categoria, nome, preço e disponibilidade (no telemóvel fica ao lado da imagem). */}
          <div className="product-detail-summary">
          <p className="product-detail-category">{product.group}</p>
          <h1>{product.name}</h1>
          <p className="product-detail-subcategory">{product.cat}</p>

          <div className="product-detail-rating" aria-label="Informação do produto">
            <span>Produto disponível para compra</span>
          </div>

          <div className="product-detail-price">
            <strong>{fmt(product.price)}</strong>
          </div>

          <div className="product-detail-divider" />

          <div className="product-detail-stock">
            <span className="stock-dot" aria-hidden="true" />
            <span>Disponível para encomenda</span>
          </div>

          </div>

          {/* Bloco de compra: quantidade + botão na mesma linha, favoritos e benefícios. */}
          <div className="product-detail-buy">
          {/* Controlo de quantidade e ação principal. */}
          <div className="product-detail-actions">
            <div className="quantity-control" aria-label="Quantidade">
              <button type="button" onClick={decrease} aria-label="Diminuir quantidade">−</button>
              <span aria-live="polite">{quantity}</span>
              <button type="button" onClick={increase} aria-label="Aumentar quantidade">+</button>
            </div>

            <button type="button" className="btn product-detail-cart" onClick={addProduct}>
              Adicionar ao carrinho
            </button>
          </div>

          <button
            type="button"
            className={"product-wishlist-btn" + (favorite ? " on" : "")}
            onClick={() => s.toggle(product.id)}
            aria-pressed={favorite}
          >
            <FavoriteIcon active={favorite} />
            <span>{favorite ? "Guardado nos favoritos" : "Adicionar aos favoritos"}</span>
          </button>

          {/* Benefícios: versão do telemóvel (no computador ficam por baixo da imagem). */}
          {renderBenefits("benefits-mobile")}
          </div>
        </div>

        {/* Especificações técnicas definidas no painel: 3.ª coluna no computador, por baixo no telemóvel (só aparece quando o produto tem alguma). */}
        {specs.length > 0 && (
          <section className="product-specs" aria-labelledby="product-specs-title">
            <h2 id="product-specs-title">Especificações técnicas</h2>
            <table className="product-specs-table">
              <tbody>
                {specs.map((x, i) => (
                  <tr key={`${x.label}-${i}`}>
                    <th scope="row">{x.label}</th>
                    <td>{x.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </div>

      {/* Informação complementar. */}
      <div className="product-detail-panels">
        <article className="product-info-card">
          <h2>Sobre este produto</h2>
          <p>Consulte as características do produto e confirme se correspondem às suas necessidades antes de finalizar a compra.</p>
        </article>

        <article className="product-info-card">
          <h2>Categoria</h2>
          <p><strong>{product.group}</strong></p>
          <p className="muted">{product.cat}</p>
        </article>
      </div>
    </section>
  );
};

/**
 * Esqueleto de carregamento: blocos cinzentos que ocupam o lugar dos cartões enquanto os dados "chegam".
 */
const SkeletonGrid = ({ count = 4 }: { count?: number }) => (
  <div className="grid skeleton-grid" aria-label="A carregar produtos" aria-busy="true">
    {Array.from({ length: count }).map((_, i) => <div className="card product-card skeleton-card" key={i}><div className="product-media skeleton-block" /><div className="product-content"><div className="skeleton-line short" /><div className="skeleton-line" /><div className="skeleton-line tiny" /><div className="skeleton-button" /></div></div>)}
  </div>
);

/**
 * Produto em destaque: faixa cinza de 990 × 330 px com título, subtítulo e descrição (esquerda),
 * carrossel de até 3 fotos (centro) e especificações definidas pelo administrador + "Comprar agora" (direita).
 */
const FeaturedBanner = ({ product, s }: { product: StoreProduct; s: Store }) => {
  const photos = [...new Set([product.image, ...(product.images ?? [])].filter(Boolean))].slice(0, 3);
  const specs = (product.specs ?? []).slice(0, 6);
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const many = photos.length > 1;
  useEffect(() => { setI(0); }, [product.id]);
  useEffect(() => {
    if (!many || paused) return;
    const t = window.setInterval(() => setI((n) => (n + 1) % photos.length), 4000);
    return () => window.clearInterval(t);
  }, [many, paused, photos.length]);
  const go = (n: number) => setI((n + photos.length) % photos.length);

  return (
    <section className="feat" aria-labelledby="feat-title">
      <div className="feat-copy">
        <span className="feat-kicker">Produto em destaque</span>
        <h2 id="feat-title" className="feat-title">{product.name}</h2>
        {product.group && <p className="feat-sub">{product.group}</p>}
        {product.description && <p className="feat-desc">{product.description}</p>}
        <div className="feat-buy-row">
          <button type="button" className="feat-buy" onClick={() => s.openProduct(product.id)}>
            Comprar agora <span className="feat-buy-arrow" aria-hidden="true">→</span>
          </button>
        </div>
      </div>

      <div className="feat-media">
        <div className="feat-gallery" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
          {photos.length > 0 && (
            <div className="feat-track" style={{ transform: `translateX(-${i * 100}%)` }}>
              {photos.map((src, n) => (
                <div className="feat-slide" key={src + n} aria-hidden={n !== i}>
                  <img src={src} alt={`${product.name} — foto ${n + 1}`} loading={n === 0 ? "eager" : "lazy"} />
                </div>
              ))}
            </div>
          )}
          {many && (
            <>
              <button type="button" className="feat-arrow prev" aria-label="Foto anterior" onClick={() => go(i - 1)}>‹</button>
              <button type="button" className="feat-arrow next" aria-label="Foto seguinte" onClick={() => go(i + 1)}>›</button>
              <div className="feat-dots">
                {photos.map((_, n) => (
                  <button key={n} type="button" className={n === i ? "on" : ""} aria-label={`Ver foto ${n + 1}`} onClick={() => setI(n)} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <aside className="feat-side" aria-label="Especificações">
        {specs.length > 0 && (
          <>
            <h3 className="feat-side-title">Especificações</h3>
            <dl className="feat-specs">
              {specs.map((x, n) => (
                <div key={`${x.label}-${n}`}><dt>{x.label}</dt><dd>{x.value}</dd></div>
              ))}
            </dl>
          </>
        )}
      </aside>
    </section>
  );
};

/**
 * Computador, página inicial: faixa de categorias (pílulas) ABAIXO do banner.
 * Mesmo caminho do cabeçalho móvel: preenche a pesquisa com o grupo e abre a página Pesquisa.
 * No telemóvel fica escondida (lá a faixa continua por baixo do cabeçalho).
 */
const HomeCatsStrip = ({ s }: { s: Store }) => {
  const ref = useRef<HTMLElement | null>(null);
  const [edge, setEdge] = useState({ start: true, end: true });
  const update = () => {
    const el = ref.current;
    if (!el) return;
    setEdge({ start: el.scrollLeft <= 2, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 2 });
  };
  const slide = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth, behavior: "smooth" });
  useEffect(() => {
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  const groups = Object.keys(categories);
  if (groups.length === 0) return null;
  const pickGroup = (g: string) => { s.setQ(g); s.go("search"); };
  return (
    <div className="cats-bar cats-home">
      <button type="button" className={`cats-arrow cats-arrow-prev${edge.start ? " is-off" : ""}`} aria-label="Categorias anteriores" onClick={() => slide(-1)}>
        <Icon d="M15 6l-6 6 6 6" size={20} />
      </button>
      <nav ref={ref} onScroll={update} className="mobile-cats" aria-label="Categorias">
        {groups.map((g) => (
          <button key={g} type="button" onClick={() => pickGroup(g)}>
            <span className="mcat-ico"><CatIcon name={g} /></span>
            <span className="mcat-name">{g}</span>
          </button>
        ))}
      </nav>
      <button type="button" className={`cats-arrow cats-arrow-next${edge.end ? " is-off" : ""}`} aria-label="Mais categorias" onClick={() => slide(1)}>
        <Icon d="M9 6l6 6-6 6" size={20} />
      </button>
    </div>
  );
};

/**
 * Computador largo, página inicial: filtro "Comprar por categorias" na margem esquerda (espaço livre ao lado do
 * conteúdo). Fica colado ao topo ao descer a página. Em ecrãs mais estreitos fica escondido (ver css/styles.css).
 */
const HomeCatsSide = ({ s }: { s: Store }) => {
  const groups = Object.keys(categories);
  if (groups.length === 0) return null;
  const pickGroup = (g: string) => { s.setQ(g); s.go("search"); };
  return (
    <div className="home-cats-side-wrap">
      <aside className="home-cats-side" aria-label="Comprar por categorias">
        <h2 className="hcs-title">Comprar por categorias</h2>
        <ul className="hcs-list">
          {groups.map((g) => (
            <li key={g}>
              <button type="button" onClick={() => pickGroup(g)}>
                <span className="hcs-ico"><CatIcon name={g} /></span>
                <span className="hcs-name">{g}</span>
                <Icon d="M9 6l6 6-6 6" size={16} />
              </button>
            </li>
          ))}
        </ul>
        <button type="button" className="hcs-all" onClick={() => s.go("categories")}>Ver todas as categorias</button>
      </aside>
    </div>
  );
};

/**
 * Página inicial: hero em destaque, filtros por categoria/preço/ordem e vitrines de produtos.
 */
const Home = ({ s }: { s: Store }) => {
  // Rodapé -> "Ofertas" / "Novidades": desce até à vitrine pedida. As vitrines podem demorar a aparecer
  // (esqueleto -> dados da API), por isso procura-a durante ~3 s antes de desistir.
  useEffect(() => {
    const key = s.homeJump.key;
    if (!key) return;
    const names = SHELF_ALIASES[key] ?? [key];
    const find = () => Array.from(document.querySelectorAll<HTMLElement>("section[data-shelf]"))
      .find((el) => (el.dataset.shelf ?? "").split("|").some((v) => names.some((n) => v.startsWith(n))));
    let tries = 0;
    const run = () => {
      const el = find();
      if (el) { el.scrollIntoView({ behavior: "smooth", block: "start" }); return true; }
      return ++tries > 25;
    };
    if (run()) return;
    const timer = window.setInterval(() => { if (run()) window.clearInterval(timer); }, 120);
    return () => window.clearInterval(timer);
  }, [s.homeJump.n, s.homeJump.key]);
  // `loading` simula o tempo de carregamento para mostrar o esqueleto (SkeletonGrid).
  const [loading, setLoading] = useState(true);
  // Produto em destaque e vitrines escolhidos pelo administrador (null enquanto carrega ou se a API falhar).
  const [home, setHome] = useState<HomeData | null>(null);
  useEffect(() => {
    let alive = true;
    fetch(`${API_BASE}/api/home`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("home"))))
      .then((d: HomeData) => { if (alive) setHome(d); })
      .catch(() => {}); // sem /api/home, a página mantém o conteúdo de reserva
    return () => { alive = false; };
  }, []);
  // Se /api/home não trouxer fotos extra/especificações do destaque, vai buscá-las ao catálogo público.
  const [featExtra, setFeatExtra] = useState<ApiProductRow | null>(null);
  const featId = home?.featured?.id;
  const featIncomplete = !!home?.featured && !(home.featured.images?.length) && !normalizeSpecs(home.featured.specs).length;
  useEffect(() => {
    if (!featId || !featIncomplete) return;
    let alive = true;
    fetch(`${API_BASE}/api/products`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("products"))))
      .then((d: { products?: ApiProductRow[] }) => { if (alive) setFeatExtra((d.products ?? []).find((x) => x.id === featId) ?? null); })
      .catch(() => {});
    return () => { alive = false; };
  }, [featId, featIncomplete]);
  const featured = home?.featured
    ? toStoreProduct(featExtra && featExtra.id === home.featured.id
        ? { ...home.featured, images: home.featured.images?.length ? home.featured.images : featExtra.images, specs: featExtra.specs ?? home.featured.specs }
        : home.featured)
    : null;
  const homeShelves = (home?.sections ?? []).filter((x) => x.products.length > 0);
  // Termina o "carregamento" simulado após 500 ms; a função devolvida cancela o temporizador.
  useEffect(() => { const timer = window.setTimeout(() => setLoading(false), 500); return () => window.clearTimeout(timer); }, []);
  return (
    <>
      {/* ------------------------------------------------------------------ */}
      {/* HERO PRINCIPAL                                                       */}
      {/* ------------------------------------------------------------------ */}
      {/* Só aparece quando o administrador escolhe um produto em destaque (painel).
          Sem produto em destaque, o hero não é mostrado — não há conteúdo fictício de reserva. */}
      {/* No computador o cartão do pedido fica ACIMA do banner; no telemóvel fica abaixo (ver css/styles.css). */}
      <HomeOrderCard s={s} place="top" />

      {/* Filtro "Comprar por categorias" na margem esquerda (só computador largo). */}
      <HomeCatsSide s={s} />

      {/* Boas-vindas: só para utilizador novo (acabou de se registar). Cartão flutuante simples. */}
      {s.user && s.profile && s.welcomeVisible && (
        <div className="welcome-card" role="status" aria-live="polite">
          <div className="welcome-card-text">
            <strong>Bem-vindo(a), {s.profile.name.trim().split(/\s+/)[0]}!</strong>
            <span>A sua conta foi criada. Boas compras na {company.name}.</span>
          </div>
          <button type="button" className="welcome-card-close" aria-label="Fechar" onClick={s.dismissWelcome}>×</button>
        </div>
      )}

      {featured && <FeaturedBanner product={featured as StoreProduct} s={s} />}

      {/* Categorias em pílulas ABAIXO do banner (só computador; no telemóvel a faixa fica no cabeçalho). */}
      <HomeCatsStrip s={s} />

      {/* Estado do pedido em curso (só com sessão iniciada e enquanto o pedido não for entregue).
          Esta cópia só aparece no telemóvel; no computador o cartão está acima do banner. */}
      <HomeOrderCard s={s} place="below" />

      {/* Vitrines (ofertas, novidades, ...). Cada uma mostra uma fatia fixa do catálogo;
         é um placeholder até existir lógica real de promoções e vendas. */}
      {/* Com vitrines configuradas no painel (/api/home), mostra só as que têm produtos. */}
      {homeShelves.map((x) => (
        <section key={x.slug} id={shelfKey(x.title)} data-shelf={`${shelfKey(x.title)}|${String(x.slug).toLowerCase()}`}><ShelfHead title={x.title} s={s} />{loading ? <SkeletonGrid count={4} /> : <Grid list={x.products.map(toStoreProduct)} s={s} />}</section>
      ))}
      {/* Reserva: enquanto o administrador não escolheu produtos (ou a API não responde), mantém as fatias fixas. */}
      {homeShelves.length === 0 && (["Ofertas e promoções", "Novidades", "Mais vendidos", "Recomendados para si"].map((t, idx) => {
        const ranges: [number, number][] = [[0, 4], [4, 8], [2, 6], [8, 12]];
        const [a, b] = ranges[idx];
        return <section key={t} id={shelfKey(t)} data-shelf={shelfKey(t)}><ShelfHead title={t} s={s} />{loading ? <SkeletonGrid count={4} /> : <Grid list={products.slice(a, b)} s={s} />}</section>;
      }))}
    </>
  );
};

// Página de categorias: escolher um grupo à esquerda e, opcionalmente, uma subcategoria.
const Categories = ({ s }: { s: Store }) => {
  const [g0, setG] = usePersistedState("cat:g", Object.keys(categories)[0]); const [sub, setSub] = usePersistedState("cat:sub", "");
  const g = g0 in categories ? g0 : Object.keys(categories)[0]; // categoria guardada que já não existe -> primeira
  return (
    <div className="split">
      <aside>{Object.keys(categories).map((c) => <button key={c} className={g === c ? "on" : ""} onClick={() => { setG(c); setSub(""); }}>{c}</button>)}</aside>
      <div><div className="chips">{(categories[g] ?? []).map((c) => <button key={c} className={sub === c ? "on" : ""} onClick={() => setSub(sub === c ? "" : c)}>{c}</button>)}</div>
        <Grid list={products.filter((p) => p.group === g && (!sub || p.cat === sub))} s={s} /></div>
    </div>
  );
};

/**
 * Página de pesquisa com filtros combinados (categoria, marca, preço, avaliação, disponibilidade) e ordenação.
 */
const Search = ({ s }: { s: Store }) => {
  const { q, setQ } = s;
  const [g, setG] = usePersistedState("search:g", "");
  const [brand, setBrand] = usePersistedState("search:brand", "");
  const [priceMax, setPriceMax] = usePersistedState("search:priceMax", "");
  const [rating, setRating] = usePersistedState("search:rating", "");
  const [availability, setAvailability] = usePersistedState("search:availability", "");
  const [sort, setSort] = usePersistedState("search:sort", "");
  // Histórico de pesquisas recentes (começa vazio).
  const [recent, setRecent] = useState<string[]>([]);
  // Marcas únicas do catálogo (Set remove duplicados), por ordem alfabética.
  const brands = Array.from(new Set(products.map((p) => p.brand).filter(Boolean) as string[])).sort();
  const maxPrice = Math.max(...products.map((p) => p.price), 0);

  // Um produto só aparece se cumprir TODOS os critérios (E lógico).
  // A pesquisa de texto procura em nome, grupo, subcategoria e marca.
  let list = products.filter((p) => {
    const matchesQuery = [p.name, p.group, p.cat, p.brand || ""].some((x) => x.toLowerCase().includes(q.toLowerCase()));
    const matchesCategory = !g || p.group === g;
    const matchesBrand = !brand || p.brand === brand;
    const matchesPrice = !priceMax || p.price <= Number(priceMax);
    const matchesRating = !rating || (p.rating || 0) >= Number(rating);
    const matchesAvailability = !availability || (availability === "available" ? p.available !== false : p.available === false);
    return matchesQuery && matchesCategory && matchesBrand && matchesPrice && matchesRating && matchesAvailability;
  });

  // Ordenação sobre uma cópia ([...list]) para não alterar o array original.
  if (sort === "asc") list = [...list].sort((a, b) => a.price - b.price);
  if (sort === "desc") list = [...list].sort((a, b) => b.price - a.price);
  if (sort === "rating") list = [...list].sort((a, b) => (b.rating || 0) - (a.rating || 0));

  // Guarda a pesquisa no histórico: sem duplicados (ignora maiúsculas) e máximo de 5 itens.
  const saveRecent = () => {
    if (!q.trim()) return;
    setRecent([q.trim(), ...recent.filter((r) => r.toLowerCase() !== q.trim().toLowerCase())].slice(0, 5));
  };
  const clearFilters = () => {
    setG(""); setBrand(""); setPriceMax(""); setRating(""); setAvailability(""); setSort("");
  };

  return (
    <section className="search-page">
      <div className="search-heading">
        <div>
          <h1>Pesquisa</h1>
          <p className="muted">Encontre rapidamente os produtos que procura.</p>
        </div>
      </div>

      <div className="search-main">
        <aside className="search-filters" aria-label="Filtros de pesquisa">
          <div className="filter-heading">
            <h3>Filtros</h3>
            <button className="link" type="button" onClick={clearFilters}>Limpar</button>
          </div>

          <label className="filter-label">Categoria
            <select value={g} onChange={(e) => setG(e.target.value)}>
              <option value="">Todas</option>
              {Object.keys(categories).map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>

          <label className="filter-label">Marca
            <select value={brand} onChange={(e) => setBrand(e.target.value)}>
              <option value="">Todas</option>
              {brands.map((b) => <option key={b}>{b}</option>)}
            </select>
          </label>

          <label className="filter-label">Preço
            <select value={priceMax} onChange={(e) => setPriceMax(e.target.value)}>
              <option value="">Qualquer preço</option>
              <option value="500">Até 500 MT</option>
              <option value="1000">Até 1.000 MT</option>
              <option value="2000">Até 2.000 MT</option>
              <option value="3000">Até 3.000 MT</option>
              <option value={String(maxPrice)}>Até {fmt(maxPrice)}</option>
            </select>
          </label>

          <label className="filter-label">Avaliação
            <select value={rating} onChange={(e) => setRating(e.target.value)}>
              <option value="">Qualquer avaliação</option>
              <option value="4">4 estrelas ou mais</option>
              <option value="4.5">4,5 estrelas ou mais</option>
              <option value="4.8">4,8 estrelas ou mais</option>
            </select>
          </label>

          <fieldset className="filter-fieldset">
            <legend>Disponibilidade</legend>
            <label><input type="radio" name="availability" checked={availability === ""} onChange={() => setAvailability("")} /> Todos</label>
            <label><input type="radio" name="availability" checked={availability === "available"} onChange={() => setAvailability("available")} /> Em stock</label>
            <label><input type="radio" name="availability" checked={availability === "unavailable"} onChange={() => setAvailability("unavailable")} /> Esgotados</label>
          </fieldset>
        </aside>

        <div className="search-results">
          <div className="search-box bar">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveRecent()}
              aria-label="Pesquisar produtos"
              placeholder="Ex.: auscultadores, carregador, powerbank"
            />
            <button className="btn" type="button" onClick={saveRecent}>Pesquisar</button>
          </div>

          {recent.length > 0 && <div className="chips search-recent">
            <span className="muted">Pesquisas recentes:</span>
            {recent.map((r) => <button key={r} type="button" onClick={() => setQ(r)}>{r}</button>)}
          </div>}

          <div className="results-head">
            <div>
              <strong>{list.length} {list.length === 1 ? "produto encontrado" : "produtos encontrados"}</strong>
              <small>{q ? ` para “${q}”` : ""}</small>
            </div>
            <label className="sort-control">
              <span>Ordenar:</span>
              <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Ordenar resultados">
                <option value="">Mais relevantes</option>
                <option value="asc">Preço: menor</option>
                <option value="desc">Preço: maior</option>
                <option value="rating">Melhor avaliação</option>
              </select>
            </label>
          </div>

          <Grid list={list} s={s} />
        </div>
      </div>
    </section>
  );
};

// Lista de desejos: permite mover um favorito para o carrinho ou removê-lo.
const Wishlist = ({ s }: { s: Store }) => (
  <section className="wishlist-page">
    <div className="wishlist-head">
      <div>
        <span className="wishlist-eyebrow">Os seus favoritos</span>
        <h2>Lista de desejos</h2>
        <p className="muted">Guarde os produtos que pretende comprar e encontre-os rapidamente quando voltar.</p>
      </div>
      {s.wish.length > 0 && <span className="wishlist-count">{s.wish.length} {s.wish.length === 1 ? "produto" : "produtos"}</span>}
    </div>
    {s.wish.length ? <div className="grid">{s.wish.map((id) => { const p = byId(id); return (
      <article className="card product-card wishlist-card" key={id} tabIndex={0} onClick={() => s.openProduct(id)} onKeyDown={(e) => e.key === "Enter" && s.openProduct(id)}>
        <div className="product-media">
          {p.image ? <img src={p.image} alt={p.name} loading="lazy" /> : <span className="product-initial" aria-hidden="true">{p.name.charAt(0).toUpperCase()}</span>}
          <button
            type="button"
            className="product-favorite on"
            aria-label={`Remover ${p.name} dos favoritos`}
            title="Remover dos favoritos"
            aria-pressed="true"
            onClick={(e) => { e.stopPropagation(); s.toggle(id); s.showToast("Removido dos favoritos"); }}
          >
            <FavoriteIcon active={true} />
          </button>
        </div>
        <div className="product-content">
          <h4 className="product-name">{p.name}</h4>
          <p className="product-meta">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 5 5L20 7" /></svg>
            <span>{p.group}</span>
          </p>
          <div className="product-price-row">
            <strong className="product-price">{fmt(p.price)}</strong>
            <button
              type="button"
              className="product-add"
              aria-label={`Adicionar ${p.name} ao carrinho`}
              title="Adicionar ao carrinho"
              onClick={(e) => { e.stopPropagation(); s.add(id); s.toggle(id); s.showToast("Produto adicionado ao carrinho"); }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6" /></svg>
            </button>
          </div>
        </div>
      </article>); })}</div>
      : <div className="wishlist-empty">
          <div className="wishlist-empty-icon"><FavoriteIcon active={false} /></div>
          <h3>A sua lista de desejos está vazia</h3>
          <p>Toque no coração de um produto para guardá-lo aqui.</p>
          <button className="btn" onClick={() => s.go("home")}>Explorar produtos</button>
        </div>}
  </section>
);

/**
 * Carrinho: altera quantidades, remove itens, aplica cupão e segue para o checkout.
 */
const VALID_COUPONS: string[] = [];
const Cart = ({ s }: { s: Store }) => {
  const [code, setCode] = useState(""); const [ok, setOk] = useState(false);
  // Verificação de stock ao clicar em "Finalizar compra": só avança se TODOS os produtos estiverem disponíveis.
  const [checking, setChecking] = useState(false);
  const [check, setCheck] = useState<CartCheck | null>(null);
  // Qualquer alteração ao carrinho invalida o resultado anterior (evita avisos desatualizados).
  useEffect(() => { setCheck(null); }, [JSON.stringify(s.cart)]);
  const issues = Object.fromEntries((check?.items ?? []).filter((i) => i.status !== "ok").map((i) => [i.productId, i]));
  // Cupões válidos: lista vazia por agora (cada cupão dá 10% de desconto).
  // Numa versão real, a validação do cupão seria feita no servidor.
  const ids = Object.keys(s.cart); const sub = cartTotal(s.cart); const disc = ok ? sub * 0.1 : 0;
  const proceed = async () => {
    if (checking) return; // trava cliques repetidos enquanto a verificação decorre
    setChecking(true);
    try {
      const r = await api.validateCart(ids.map((id) => ({ productId: id, quantity: s.cart[id] })));
      if (r.ok) { s.go(s.user ? "checkout" : "auth"); return; }
      setCheck(r);
      s.showToast("Reveja os produtos assinalados no carrinho.");
    } catch (e) {
      s.showToast(e instanceof ApiError ? e.message : "Não foi possível verificar o stock. Tente novamente.");
    } finally { setChecking(false); }
  };
  // Ajusta o carrinho ao que existe: reduz à quantidade disponível ou remove o que esgotou/ficou indisponível.
  const adjust = () => {
    if (!check) return;
    for (const i of check.items) {
      if (i.status === "ok") continue;
      const cur = s.cart[i.productId] ?? 0;
      s.add(i.productId, i.available > 0 ? i.available - cur : -cur);
    }
    s.showToast("Carrinho ajustado ao stock disponível.");
  };
  if (!ids.length) return <section><h2>Carrinho</h2><p className="muted">O carrinho está vazio.</p><button className="btn" onClick={() => s.go("home")}>Explorar produtos</button></section>;
  return (
    <div className="split cart">
      <div><h2>Carrinho</h2>{ids.map((id) => { const p = byId(id); if (!p) return (
        // Catálogo ainda a carregar (ex.: depois de atualizar a página): mostra um espaço reservado.
        <div className="line" key={id}><div className="img sm" aria-hidden="true" /><div className="grow"><h4>A carregar…</h4></div></div>); return (
        <div className="line" key={id}><div className="img sm">{p.image ? <img src={p.image} alt={p.name} loading="lazy" /> : p.name[0]}</div><div className="grow"><h4>{p.name}</h4><small>{fmt(p.price)}</small>
            {issues[id] && <small className="auth-err" role="alert" style={{ display: "block" }}>{issues[id].message}</small>}</div>
          <div className="qty"><button onClick={() => s.add(id, -1)}>−</button><span>{s.cart[id]}</span>
            <button disabled={s.cart[id] >= Math.min(p.stock ?? 99, 99)} title={s.cart[id] >= (p.stock ?? 99) ? "Stock máximo atingido" : undefined} onClick={() => s.add(id, 1)}>+</button></div>
          <button className="link" onClick={() => { if (window.confirm("Remover este produto do carrinho?")) { s.add(id, -s.cart[id]); s.showToast("Produto removido do carrinho"); } }}>Remover</button></div>); })}</div>
      <div className="panel"><h3>Resumo do pedido</h3>
        <div className="bar"><input type="text" maxLength={30} autoCapitalize="characters" autoComplete="off" value={code} onChange={(e) => setCode(e.target.value.replace(/[^A-Za-z0-9-]/g, "").toUpperCase())} aria-label="Código do cupão" /><button className="btn ghost" onClick={() => setOk(VALID_COUPONS.includes(code.trim().toUpperCase()))}>Aplicar</button></div>
        <p className="sum"><span>Subtotal</span><span>{fmt(sub)}</span></p>
        {ok && <p className="sum"><span>Desconto</span><span>−{fmt(disc)}</span></p>}
        <p className="sum total"><span>Total</span><span>{fmt(sub - disc)}</span></p>
        {check && !check.ok && <button className="btn ghost full" onClick={adjust}>Ajustar carrinho ao stock disponível</button>}
        <button className="btn full" disabled={checking} onClick={proceed}>{checking ? "A verificar stock..." : "Finalizar compra"}</button></div>
    </div>
  );
};

// Cidade e província da entrega Expresso (dentro da cidade). Fora da cidade o cliente escreve a localidade.
const DELIVERY_CITY = "Cidade da Beira";
const DELIVERY_PROVINCE = "Sofala";
// Zonas (bairros) da Cidade da Beira, agrupadas por posto administrativo (26 bairros).
const BEIRA_ZONES: { posto: string; bairros: string[] }[] = [
  { posto: "Posto Administrativo Central", bairros: ["Chaimite", "Chipangara", "Esturro", "Macurungo", "Macuti", "Matacuane", "Pioneiros", "Ponta-Gêa"] },
  { posto: "Posto Administrativo da Munhava", bairros: ["Chota", "Mananga", "Maraza", "Munhava-Central", "Vaz"] },
  { posto: "Posto Administrativo de Inhamízua", bairros: ["Alto da Manga", "Chingussura", "Inhamízua", "Matadouro", "Nhaconjo", "Vila Massane"] },
  { posto: "Posto Administrativo de Manga-Loforte", bairros: ["Manga Mascarenhas", "Muave", "Mungassa", "Ndunda"] },
  { posto: "Posto Administrativo de Nhangau", bairros: ["Nhangau", "Nhangoma", "Tchonja"] },
];
// `inCity`: true = dentro da cidade da Beira (bairro da lista, Expresso 45 min); false = fora da cidade (localidade escrita, 1 hora e 30 minutos).
// Em `neighborhood` guarda-se o bairro (dentro) ou a localidade/distrito (fora).
type AddressForm = { name: string; phone: string; province: string; city: string; inCity: boolean; neighborhood: string; street: string; reference: string };
type AddressTextKey = Exclude<keyof AddressForm, "inCity">;
// Telemóvel moçambicano: 82–87 + 7 dígitos, com ou sem prefixo +258.
const MZ_PHONE = /^(?:\+?258)?8[2-7]\d{7}$/;
// Valida a morada e devolve um erro por campo (objeto vazio = tudo válido).
const validateAddress = (a: AddressForm) => {
  const e: Record<string, string> = {};
  const name = a.name.trim();
  if (name.length < 3) e.name = "Indique o nome completo de quem recebe.";
  else if (!PERSON_NAME_RE.test(name)) e.name = "O nome só pode ter letras, espaços, apóstrofo e hífen.";
  const phone = a.phone.replace(/[\s-]/g, "");
  if (!phone) e.phone = "Indique o número de telemóvel.";
  else if (!MZ_PHONE.test(phone)) e.phone = "Use 9 dígitos a começar por 82 a 87.";
  const place = a.neighborhood.trim();
  if (!place) e.neighborhood = "Indique o bairro.";
  else if (!(BEIRA_ZONES.some((g) => g.bairros.includes(place)))) e.neighborhood = "Selecione um bairro da cidade da Beira.";
  const reference = a.reference.trim();
  if (reference.length < 3) e.reference = "Indique um ponto de referência obrigatório (ex.: escola, loja ou paragem).";
  else if (!ADDRESS_TEXT_RE.test(reference)) e.reference = "Há símbolos não permitidos. Use letras, números e . , - /";
  return e;
};
// Junta os campos numa morada legível, uma informação por linha (campos vazios são ignorados).
const formatAddress = (a: AddressForm) => [
  [a.name.trim(), a.phone.trim()].filter(Boolean).join(" · "),
  [a.neighborhood.trim(), DELIVERY_CITY].filter(Boolean).join(", "),
  a.province,
  a.reference.trim() && `Referência: ${a.reference.trim()}`,
].filter(Boolean).join("\n");

// Modalidades de entrega. O `value` é o texto enviado ao servidor (deliveryMethod) e TEM de coincidir com DELIVERY_METHODS do backend.
// Só existe uma por morada: dentro da cidade = Expresso (45 min); fora da cidade = 1 hora e 30 minutos.
const DELIVERY_IN_CITY = { value: "Expresso (45 minutos)", title: "Entrega Expresso", time: "45 minutos", desc: "Dentro da cidade da Beira: o seu pedido chega em cerca de 45 minutos.", badge: "Mais rápida" };
const deliveryFor = (_inCity: boolean) => DELIVERY_IN_CITY;
// Formas de pagamento. O `value` é o texto enviado ao servidor (paymentMethod).
// `unavailable: true` = ainda não aceite: aparece riscada, com selo "Indisponível", e não pode ser escolhida.
const PAYMENT_OPTIONS: Array<{ value: string; title: string; desc: string; unavailable?: boolean }> = [
  { value: "M-Pesa", title: "M-Pesa", desc: "Pague com o seu telemóvel através do M-Pesa.", unavailable: true },
  { value: "e-Mola", title: "e-Mola", desc: "Pague com o seu telemóvel através do e-Mola.", unavailable: true },
  { value: "Pagamento na entrega", title: "Pagamento na entrega", desc: "Pague quando receber a sua compra.", unavailable: false },
];
const PAYMENT_FALLBACK = "Pagamento na entrega";
/** True se a forma de pagamento existe e está disponível (usado para ignorar preferências antigas de M-Pesa/e-Mola). */
const isPaymentAvailable = (value: string | null | undefined) => PAYMENT_OPTIONS.some((o) => o.value === value && !o.unavailable);
// Estilo do texto riscado das opções indisponíveis (inline para não depender do CSS).
const STRIKE: CSSProperties = { textDecoration: "line-through", opacity: 0.55 };
const SOLD_OUT_BADGE: CSSProperties = { marginLeft: 8, fontSize: 11, fontStyle: "normal", fontWeight: 600, padding: "2px 8px", borderRadius: 999, background: "rgba(220,38,38,.12)", color: "#b91c1c", textDecoration: "none", whiteSpace: "nowrap" };
// Etapas do checkout, na ordem em que aparecem.
/* ========================================================================== */
/* Estado do pedido (acompanhamento + notificações)                            */
/* ========================================================================== */

/** Ícones (traços SVG, usados com o componente <Icon d=... />). */
const IC = {
  check: "M20 6 9 17l-5-5",
  checkAll: "M18 6 7 17l-5-5M22 10l-7.5 7.5L13 16",
  clipboard: "M9 3h6a1 1 0 0 1 1 1v1H8V4a1 1 0 0 1 1-1zM8 5H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-2M9 14l2 2 4-4",
  box: "M21 8 12 3 3 8v8l9 5 9-5zM3 8l9 5 9-5M12 13v8",
  moto: MOTO_PATH,
  home: "M3 11l9-8 9 8M5 10v10h14V10M10 20v-6h4v6",
  xCircle: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM15 9l-6 6M9 9l6 6",
  clock: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2",
  copy: "M9 9h11v11H9zM5 15H4V4h11v1",
  refresh: "M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5",
  chevron: "M6 9l6 6 6-6",
  cart: "M6 6h15l-2 9H8zM6 6 5 3H2M9 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM18 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2z",
  trash: "M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6",
  help: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17h.01",
};

/**
 * Traduz o `status` guardado na base de dados (e alterado pelo painel de administração)
 * para o que o cliente vê:
 *  - label:  texto curto do selo de estado;
 *  - title:  título da notificação no sino;
 *  - step:   posição na linha do tempo (0 = recebido ... 3 = entregue; -1 = cancelado);
 *  - tone:   cor (wait = a decorrer, go = a caminho, ok = concluído, bad = cancelado);
 *  - notice: frase mostrada ao cliente.
 */
type OrderTone = "wait" | "go" | "ok" | "bad";
type OrderStatusInfo = { label: string; title: string; step: number; tone: OrderTone; notice: string };
const ORDER_STATUS: Record<string, OrderStatusInfo> = {
  pending:    { label: "A ser preparado",      title: "Pedido em preparação", step: 1,  tone: "wait", notice: "O seu pedido está a ser preparado para a entrega." },
  paid:       { label: "Pagamento confirmado", title: "Pagamento confirmado", step: 1,  tone: "wait", notice: "Pagamento confirmado. O seu pedido está a ser preparado para a entrega." },
  processing: { label: "A ser preparado",      title: "Pedido em preparação", step: 1,  tone: "wait", notice: "O seu pedido está a ser preparado para a entrega." },
  shipped:    { label: "A caminho",            title: "Pedido a caminho",     step: 2,  tone: "go",   notice: "O seu pedido saiu para entrega e está a caminho." },
  completed:  { label: "Entregue",             title: "Pedido entregue",      step: 3,  tone: "ok",   notice: "O seu pedido foi entregue. Obrigado pela compra!" },
  cancelled:  { label: "Cancelado",            title: "Pedido cancelado",     step: -1, tone: "bad",  notice: "O seu pedido foi cancelado." },
};
/** Estado desconhecido (ex.: novo estado criado no futuro) cai numa mensagem genérica em vez de partir o ecrã. */
const statusInfo = (status: string): OrderStatusInfo =>
  ORDER_STATUS[status] ?? { label: status, title: "Pedido atualizado", step: 1, tone: "wait", notice: `O estado do seu pedido mudou para "${status}".` };
/** Ícone de cada tom (sino e cartão de previsão). */
const TONE_ICON: Record<OrderTone, string> = { wait: IC.box, go: IC.moto, ok: IC.check, bad: IC.xCircle };
/** Etapas da linha do tempo, por ordem, e o ícone de cada uma. */
const TRACK_STEPS = ["Pedido recebido", "Em preparação", "A caminho", "Entregue"];
const STEP_ICONS = [IC.clipboard, IC.box, IC.moto, IC.home];

/** Número curto e legível do pedido (o id completo é um uuid comprido). */
const shortId = (id: string) => "#" + id.slice(0, 8).toUpperCase();
const orderDate = (iso: string) =>
  new Date(iso).toLocaleString("pt-PT", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
/** "agora mesmo", "há 5 min", "há 2 h", "há 3 dias"... */
const timeAgo = (iso: string) => {
  const sec = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (sec < 60) return "agora mesmo";
  const min = Math.floor(sec / 60);
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  return d < 7 ? `há ${d} ${d === 1 ? "dia" : "dias"}` : orderDate(iso);
};

/** Minutos prometidos pela modalidade de entrega (ou null se for em dias). */
const deliveryMinutes = (method: string): number | null => {
  // Soma horas e minutos: "45 minutos" = 45; "1 hora" = 60; "1 hora e 30 minutos" / "1h 30 min" = 90; "Normal (1–2 dias)" = null.
  const h = method.match(/(\d+)\s*h(?:ora)?s?\b/i);
  const m = method.match(/(\d+)\s*min/i);
  if (!h && !m) return null;
  return (h ? Number(h[1]) * 60 : 0) + (m ? Number(m[1]) : 0);
};
/** Previsão de entrega, calculada a partir da data do pedido e da modalidade escolhida. */
const etaInfo = (o: ApiOrder): string => {
  if (o.status === "cancelled") return "Se já pagou, contacte o suporte indicando a referência do pedido.";
  if (o.status === "completed") return "Entrega concluída.";
  const start = new Date(o.createdAt).getTime();
  const day = (d: Date) => d.toLocaleDateString("pt-PT", { day: "numeric", month: "short" });
  // "Expresso (45 minutos)", "Fora da cidade (1 hora e 30 minutos)" e pedidos antigos ("Expresso (30 minutos)", "Fora da cidade (1 hora)") dão minutos; "Normal (1–2 dias)" não.
  const mins = deliveryMinutes(o.deliveryMethod);
  if (mins) {
    const end = new Date(start + mins * 60000);
    if (end.getTime() < Date.now()) return "A entrega está a demorar mais do que o previsto. Estamos a tratar do seu pedido.";
    const hh = end.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
    return `Previsão de entrega: ${end.toDateString() === new Date().toDateString() ? "hoje" : day(end)} até às ${hh}`;
  }
  return `Previsão de entrega: entre ${day(new Date(start + 864e5))} e ${day(new Date(start + 2 * 864e5))}`;
};

/** Chave de uma notificação: muda quando o estado do pedido muda, por isso cada mudança volta a ser "nova". */
const notifKey = (o: ApiOrder) => `${o.id}:${o.status}`;
/** Notificações já lidas ficam no navegador (por conta), para o contador do sino não reaparecer. */
const loadSeen = (key: string): string[] | null => {
  try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as string[]) : null; } catch { return null; }
};
const saveSeen = (key: string, list: string[]) => {
  try { localStorage.setItem(key, JSON.stringify(list.slice(-100))); } catch { /* armazenamento indisponível: ignora */ }
};

/** Foto do produto do item (se o produto ainda existir no catálogo), senão a inicial do nome. */
const Thumb = ({ item }: { item: ApiOrderItem }) => {
  const src = item.productId ? products.find((p) => p.id === item.productId)?.image : undefined;
  return <span className="ord-thumb">{src ? <img src={src} alt="" loading="lazy" /> : <span>{item.name.charAt(0).toUpperCase()}</span>}</span>;
};

/** Telefone do entregador legível: "+258841234567" -> "+258 84 123 4567". */
const driverPhone = (p: string) => p.replace(/^\+258(\d{2})(\d{3})(\d{4})$/, "+258 $1 $2 $3");

/**
 * Dados do entregador do pedido (nome, veículo e telefone com botão de ligar).
 * Só aparece quando o pedido está em curso e já tem entregador atribuído; depois de entregue ou cancelado desaparece.
 */
const DriverInfo = ({ o }: { o: ApiOrder }) => {
  const st = statusInfo(o.status).step;
  if (!o.driver || st < 0 || st >= 3) return null;
  const { name, phone, vehicle } = o.driver;
  return (
    <div className="ord-driver" aria-label="Entregador do seu pedido">
      <span className="ord-driver-ico" aria-hidden="true"><Icon d={IC.moto} size={20} /></span>
      <div className="ord-driver-text">
        <small>O seu entregador</small>
        <strong>{name}</strong>
        {vehicle && <span>{vehicle}</span>}
      </div>
      <a className="btn ghost ord-driver-call" href={`tel:${phone}`}>Ligar · {driverPhone(phone)}</a>
    </div>
  );
};

/** Linha do tempo do pedido: Recebido -> Em preparação -> A caminho -> Entregue. */
const OrderTracker = ({ status }: { status: string }) => {
  const info = statusInfo(status);
  if (info.step < 0) return <p className="ord-cancelled" role="status"><Icon d={IC.xCircle} size={18} /> Este pedido foi cancelado.</p>;
  return (
    <ol className="ord-track" aria-label="Progresso do pedido">
      {TRACK_STEPS.map((t, n) => {
        const done = n < info.step || info.step === 3; // tudo concluído quando entregue
        const current = n === info.step && !done;
        return (
          <li key={t} className={done ? "done" : current ? "current" : ""} aria-current={current ? "step" : undefined}>
            <span className="ord-dot"><Icon d={done ? IC.check : STEP_ICONS[n]} size={15} /></span>
            <span className="ord-label">{t}</span>
          </li>
        );
      })}
    </ol>
  );
};

/** Selo colorido com o estado atual. */
const StatusPill = ({ status }: { status: string }) => {
  const info = statusInfo(status);
  return <span className={`ord-pill tone-${info.tone}`}>{info.label}</span>;
};

/**
 * Cartão "O seu pedido" da página inicial: acima do banner no computador e abaixo do banner no telemóvel.
 * `place` escolhe a cópia: "top" (só computador) ou "below" (só telemóvel); o CSS esconde a outra.
 * Aparece enquanto o pedido mais recente estiver em curso (a preparar ou a caminho) e
 * desaparece sozinho quando o estado passa a "Entregue" (ou "Cancelado").
 * Toque no cartão abre o pedido em Conta → Pedidos.
 */
const HomeOrderCard = ({ s, place }: { s: Store; place: "top" | "below" }) => {
  const active = s.orders.filter((o) => { const st = statusInfo(o.status).step; return st >= 0 && st < 3; });
  if (active.length === 0) return null;
  const o = active[0];
  const info = statusInfo(o.status);
  const units = o.items.reduce((n, it) => n + it.quantity, 0);
  return (
    <section className={`hp-order hp-order--${place} tone-${info.tone}`} aria-label="Acompanhamento do seu pedido">
      <div className="hp-order-topline">
        <span className="hp-order-live"><i aria-hidden="true" /> PEDIDO EM CURSO</span>
        {active.length > 1 && <span className="hp-order-extra">+{active.length - 1} {active.length - 1 === 1 ? "pedido" : "pedidos"}</span>}
      </div>
      <button type="button" className="hp-order-main" onClick={() => s.openAccount("Pedidos", o.id)} aria-label={`Acompanhar pedido ${shortId(o.id)}: ${info.label}`}>
        <span className="hp-order-ico" aria-hidden="true"><Icon d={TONE_ICON[info.tone]} size={22} /></span>
        <span className="hp-order-text">
          <strong>{info.title}</strong>
          <small>{shortId(o.id)} <span aria-hidden="true">·</span> {units} {units === 1 ? "artigo" : "artigos"} <span aria-hidden="true">·</span> <b>{fmt(o.total)}</b></small>
          <em>{etaInfo(o)}</em>
          {o.driver && <small className="hp-order-driver">Entregador: {o.driver.name}</small>}
        </span>
        <span className="hp-order-go"><span>Acompanhar</span><Icon d={IC.chevron} size={17} /></span>
      </button>
      <div className="hp-order-progress-head"><span>Progresso da entrega</span><StatusPill status={o.status} /></div>
      <ol className="hp-order-steps" aria-label="Progresso do pedido">
        {TRACK_STEPS.map((t, n) => (
          <li key={t} className={n < info.step || info.step === 3 ? "done" : n === info.step ? "current" : ""} aria-current={n === info.step ? "step" : undefined}>
            <i aria-hidden="true" />
            <span>{t}</span>
          </li>
        ))}
      </ol>
    </section>
  );
};

/** Filtros da lista de pedidos. */
type OrderFilter = "all" | "active" | "done" | "cancelled";
const FILTERS: { key: OrderFilter; label: string }[] = [
  { key: "all", label: "Todos" }, { key: "active", label: "Em curso" }, { key: "done", label: "Entregues" }, { key: "cancelled", label: "Cancelados" },
];
const inFilter = (o: ApiOrder, f: OrderFilter) =>
  f === "all" ? true : f === "active" ? ["pending", "paid", "processing", "shipped"].includes(o.status) : f === "done" ? o.status === "completed" : o.status === "cancelled";

/**
 * Secção "Pedidos" da conta. O cliente pode:
 *  - filtrar (Todos / Em curso / Entregues / Cancelados) e abrir cada pedido;
 *  - ver a linha do tempo e a previsão de entrega;
 *  - copiar a referência, comprar novamente ou pedir ajuda;
 *  - cancelar o pedido enquanto ele ainda está "a ser preparado" (o stock volta à loja);
 *  - eliminar da lista os pedidos já terminados (entregues ou cancelados).
 * Os dados são atualizados sozinhos de 20 em 20 s (ver StoreApp), por isso quando o administrador
 * muda o estado o cliente vê a mudança sem recarregar a página.
 */
const Orders = ({ s }: { s: Store }) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = usePersistedState<OrderFilter>("orders:filter", "all");
  // undefined = o primeiro da lista começa aberto; "" = todos fechados.
  const [openId, setOpenId] = useState<string | undefined>(undefined);
  const [confirm, setConfirm] = useState<{ id: string; kind: "cancel" | "delete" } | null>(null); // pedido à espera de confirmação
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<{ id: string; msg: string } | null>(null);

  useEffect(() => { s.refreshOrders().finally(() => setLoading(false)); }, []);

  // Vindo de uma notificação do sino: abre logo esse pedido e leva-o à vista.
  useEffect(() => {
    const id = s.accountTarget.orderId;
    if (!id) return;
    setFilter("all"); setOpenId(id);
    const t = window.setTimeout(() => document.getElementById(`ord-${id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 80);
    return () => window.clearTimeout(t);
  }, [s.accountTarget]);

  const refresh = async () => { setRefreshing(true); await s.refreshOrders(); window.setTimeout(() => setRefreshing(false), 400); };
  const copyRef = async (o: ApiOrder) => {
    try { await navigator.clipboard.writeText(o.id); s.showToast("Referência do pedido copiada."); } catch { s.showToast("Não foi possível copiar."); }
  };
  // Põe no carrinho os artigos do pedido que ainda existem no catálogo e estão disponíveis.
  const buyAgain = (o: ApiOrder) => {
    let added = 0;
    for (const it of o.items) {
      const p = it.productId ? products.find((x) => x.id === it.productId) : undefined;
      if (p && (p as { available?: boolean }).available !== false) { s.add(p.id, it.quantity); added++; }
    }
    if (added === 0) { s.showToast("Estes produtos já não estão disponíveis."); return; }
    s.showToast(added === 1 ? "Produto adicionado ao carrinho." : `${added} produtos adicionados ao carrinho.`);
    s.go("cart");
  };
  // Elimina um pedido já terminado — cancelado ou entregue (some da lista e do sino).
  const remove = async (o: ApiOrder) => {
    setBusyId(o.id); setErr(null);
    try {
      await api.deleteOrder(o.id);
      s.removeOrder(o.id); setConfirm(null);
      s.showToast("Pedido eliminado.");
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) { s.setProfile(null); s.setUser(false); s.showToast("Sessão expirada. Inicie sessão novamente."); s.go("auth"); return; }
      setErr({ id: o.id, msg: e instanceof ApiError ? e.message : "Não foi possível eliminar o pedido." });
      s.refreshOrders();
    } finally { setBusyId(null); }
  };
  const cancel = async (o: ApiOrder) => {
    setBusyId(o.id); setErr(null);
    try {
      const { order } = await api.cancelOrder(o.id);
      s.updateOrder(order); setConfirm(null);
      s.showToast("Pedido cancelado.");
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) { s.setProfile(null); s.setUser(false); s.showToast("Sessão expirada. Inicie sessão novamente."); s.go("auth"); return; }
      setErr({ id: o.id, msg: e instanceof ApiError ? e.message : "Não foi possível cancelar o pedido." });
      s.refreshOrders(); // o estado pode ter mudado entretanto
    } finally { setBusyId(null); }
  };

  if (loading && s.orders.length === 0) {
    return <div className="ord-skel" role="status" aria-label="A carregar os seus pedidos"><span /><span /><span /></div>;
  }
  if (s.orders.length === 0) {
    return (
      <div className="ord-empty">
        <span className="ord-empty-ico"><Icon d={IC.box} size={30} /></span>
        <h3>Ainda não tem pedidos</h3>
        <p className="muted">Quando fizer uma compra, poderá acompanhar aqui cada etapa da entrega.</p>
        <button className="btn" onClick={() => s.go("home")}>Começar a comprar</button>
      </div>
    );
  }

  const count = (f: OrderFilter) => s.orders.filter((o) => inFilter(o, f)).length;
  const list = s.orders.filter((o) => inFilter(o, filter));
  const active = count("active");
  const shownOpen = openId === undefined ? list[0]?.id : openId;

  return (
    <div className="ord">
      <div className="ord-toolbar">
        <div className="ord-chips" role="tablist" aria-label="Filtrar pedidos">
          {FILTERS.map((f) => (
            <button key={f.key} type="button" role="tab" aria-selected={filter === f.key} className={`ord-chip ${filter === f.key ? "on" : ""}`} onClick={() => setFilter(f.key)}>
              {f.label}<b>{count(f.key)}</b>
            </button>
          ))}
        </div>
        <button type="button" className={`ord-refresh ${refreshing ? "spin" : ""}`} onClick={refresh} disabled={refreshing} aria-label="Atualizar pedidos" title="Atualizar">
          <Icon d={IC.refresh} size={16} /><span>Atualizar</span>
        </button>
      </div>
      <p className="ord-live"><i aria-hidden="true" />Atualização automática · {active === 0 ? "sem pedidos em curso" : `${active} ${active === 1 ? "pedido em curso" : "pedidos em curso"}`}</p>

      {list.length === 0 ? <p className="muted ord-none">Nenhum pedido neste filtro.</p> : (
        <ul className="ord-list">
          {list.map((o) => {
            const info = statusInfo(o.status);
            const open = shownOpen === o.id;
            const units = o.items.reduce((n, i) => n + i.quantity, 0);
            return (
              <li key={o.id} id={`ord-${o.id}`} className={`ord-card tone-${info.tone} ${open ? "open" : ""}`}>
                <button type="button" className="ord-head" aria-expanded={open} onClick={() => { setOpenId(open ? "" : o.id); setConfirm(null); setErr(null); }}>
                  <span className="ord-thumbs" aria-hidden="true">
                    {o.items.slice(0, 3).map((it) => <Thumb key={it.id} item={it} />)}
                    {o.items.length > 3 && <span className="ord-thumb more">+{o.items.length - 3}</span>}
                  </span>
                  <span className="ord-head-main">
                    <strong>Pedido {shortId(o.id)}</strong>
                    <small>{orderDate(o.createdAt)} · {units} {units === 1 ? "artigo" : "artigos"}</small>
                  </span>
                  <span className="ord-head-status-price">
                    <StatusPill status={o.status} />
                    <span className="ord-head-total">{fmt(o.total)}</span>
                  </span>
                  <span className="ord-chev" aria-hidden="true"><Icon d={IC.chevron} size={18} /></span>
                </button>

                {open && (
                  <div className="ord-body">
                    <div className={`ord-eta tone-${info.tone}`} role="status">
                      <Icon d={TONE_ICON[info.tone]} size={22} />
                      <div><strong>{info.notice}</strong><span>{etaInfo(o)}</span></div>
                    </div>
                    <OrderTracker status={o.status} />
                    <DriverInfo o={o} />

                    <h4 className="ord-sub">Artigos</h4>
                    <ul className="ord-items">
                      {o.items.map((it) => (
                        <li key={it.id}>
                          <Thumb item={it} />
                          <span className="ord-item-name">{it.name}<small>{it.quantity} × {fmt(it.unitPrice)}</small></span>
                          <span className="ord-item-sub">{fmt(it.subtotal)}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="ord-price-breakdown"><p><span>Subtotal dos produtos</span><span>{fmt(o.total - (o.deliveryFee ?? 0))}</span></p><p><span>Entrega</span><span>{(o.deliveryFee ?? 0) > 0 ? fmt(o.deliveryFee) : "Grátis / a confirmar"}</span></p><p className="ord-total"><span>Total do pedido</span><strong>{fmt(o.total)}</strong></p></div>

                    <div className="ord-info">
                      <div><small>Pagamento</small><span>{o.paymentMethod}</span></div>
                      <div className="wide"><small>Morada de entrega</small><span className="ord-addr">{o.shippingAddress}</span></div>
                      <div className="wide"><small>Referência</small><span className="ord-ref">{o.id}</span></div>
                    </div>

                    {err?.id === o.id && <p className="auth-err" role="alert">{err.msg}</p>}
                    <div className="ord-actions">
                      <button type="button" className="btn ghost" onClick={() => copyRef(o)}><Icon d={IC.copy} size={16} /> Copiar referência</button>
                      <button type="button" className="btn ghost" onClick={() => buyAgain(o)}><Icon d={IC.cart} size={16} /> Comprar novamente</button>
                      <button type="button" className="btn ghost" onClick={() => { s.setInfo("Contacto"); s.go("info"); }}><Icon d={IC.help} size={16} /> Ajuda</button>
                      {o.status === "pending" && (confirm?.id === o.id ? (
                        <span className="ord-confirm">
                          <span>Cancelar este pedido?</span>
                          <button type="button" className="btn danger" disabled={busyId === o.id} onClick={() => cancel(o)}>{busyId === o.id ? "A cancelar..." : "Sim, cancelar"}</button>
                          <button type="button" className="btn ghost" disabled={busyId === o.id} onClick={() => setConfirm(null)}>Não</button>
                        </span>
                      ) : (
                        <button type="button" className="ord-cancel" onClick={() => { setConfirm({ id: o.id, kind: "cancel" }); setErr(null); }}>Cancelar pedido</button>
                      ))}
                      {(o.status === "cancelled" || o.status === "completed") && (confirm?.id === o.id && confirm.kind === "delete" ? (
                        <span className="ord-confirm">
                          <span>Eliminar este pedido do seu histórico?</span>
                          <button type="button" className="btn danger" disabled={busyId === o.id} onClick={() => remove(o)}>{busyId === o.id ? "A eliminar..." : "Sim, eliminar"}</button>
                          <button type="button" className="btn ghost" disabled={busyId === o.id} onClick={() => setConfirm(null)}>Não</button>
                        </span>
                      ) : (
                        <button type="button" className="ord-cancel" onClick={() => { setConfirm({ id: o.id, kind: "delete" }); setErr(null); }}><Icon d={IC.trash} size={15} /> Eliminar pedido</button>
                      ))}
                    </div>
                    {["paid", "processing", "shipped"].includes(o.status) && <p className="muted ord-hint">Este pedido já não pode ser cancelado online. Para qualquer alteração, fale com o suporte. Poderá eliminá-lo da lista depois de entregue.</p>}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

const steps = ["Morada", "Entrega", "Pagamento", "Revisão", "Confirmação"];
/**
 * Checkout em passos. O índice `i` indica a etapa atual (0 = Morada ... 4 = Confirmação).
 * Ao confirmar (passo 3) chama POST /api/orders: o servidor confere sessão, produtos, preços e stock,
 * cria o pedido e devolve-o. O pagamento por M-Pesa/e-Mola ainda não é cobrado online.
 */
/** Chave única por tentativa de compra (crypto.randomUUID só existe em HTTPS/localhost, por isso há alternativa). */
const newIdempotencyKey = (): string =>
  globalThis.crypto?.randomUUID?.() ??
  "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => { const r = (Math.random() * 16) | 0; return (c === "x" ? r : (r & 0x3) | 0x8).toString(16); });

const Checkout = ({ s }: { s: Store }) => {
  // Passo, morada, pagamento e cotação ficam guardados: ao atualizar a página o cliente continua no mesmo passo.
  const [i0, setI] = usePersistedState("checkout:step", 0);
  const i = i0 >= 0 && i0 <= 3 ? Math.floor(i0) : 0; // o passo 4 (pedido feito) nunca é restaurado
  useEffect(() => { window.scrollTo({ top: 0, behavior: "auto" }); }, [i]);
  // Morada estruturada; é convertida num único texto (uma informação por linha) para enviar ao servidor (shippingAddress, máx. ~300 caracteres).
  const [addr, setAddr] = usePersistedState<AddressForm>("checkout:addr", {
    name: s.profile?.name ?? "", phone: (s.profile?.phone ?? "").replace(/^\+258/, ""), province: DELIVERY_PROVINCE, city: DELIVERY_CITY,
    inCity: true, neighborhood: "", street: "", reference: "",
  });
  const [addrErrs, setAddrErrs] = useState<Record<string, string>>({});
  const [deliveryQuote, setDeliveryQuote] = usePersistedState<DeliveryQuote | null>("checkout:quote", null); // se o token expirar, o servidor recusa e o checkout volta ao passo 1
  // Moradas guardadas na conta: a padrão vem escolhida logo; "new" = o cliente prefere escrever outra.
  const [picked, setPicked] = usePersistedState<string | null>("checkout:picked", null);
  const [deleteAddressId, setDeleteAddressId] = useState<string | null>(null);
  const [deletingAddress, setDeletingAddress] = useState(false);
  const [saveAddr, setSaveAddr] = usePersistedState("checkout:saveAddr", true);
  const usingSaved = picked !== null && picked !== "new";

  const deleteSavedAddress = async (id: string) => {
    if (deletingAddress) return;
    setDeletingAddress(true);
    try {
      const { addresses } = await api.deleteAddress(id);
      s.setAddresses(addresses);
      if (picked === id) {
        setPicked(addresses.length ? (addresses.find((a) => a.isDefault) ?? addresses[0]).id : "new");
        setDeliveryQuote(null);
      }
      setDeleteAddressId(null);
      s.showToast("Morada eliminada com sucesso.");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) { sessionLost(s); return; }
      s.showToast(err instanceof ApiError ? err.message : "Não foi possível eliminar a morada.");
    } finally {
      setDeletingAddress(false);
    }
  };
  const applySaved = (a: ApiAddress) => {
    setDeliveryQuote(null);
    setAddr({ name: a.name, phone: a.phone, province: DELIVERY_PROVINCE, city: DELIVERY_CITY, inCity: true, neighborhood: a.neighborhood, street: "", reference: a.reference });
    setAddrErrs({}); setPicked(a.id);
  };
  const chooseNew = () => {
    setAddr({ name: s.profile?.name ?? "", phone: (s.profile?.phone ?? "").replace(/^\+258/, ""), province: DELIVERY_PROVINCE, city: DELIVERY_CITY, inCity: true, neighborhood: "", street: "", reference: "" });
    setAddrErrs({}); setPicked("new");
  };
  const setField = (k: keyof AddressForm, v: string) => {
    if (k === "neighborhood") setDeliveryQuote(null); // o custo não depende do ponto de referência
    setAddr((a) => ({ ...a, [k]: v }));
    if (addrErrs[k]) setAddrErrs((e) => { const n = { ...e }; delete n[k]; return n; });
  };
  const address = formatAddress(addr);
  // A modalidade de entrega é definida pela zona da morada (dentro da cidade: Expresso 45 min; fora: 1 hora e 30 minutos).
  const delivery = DELIVERY_IN_CITY.value;
  // A forma de pagamento padrão da conta vem já escolhida (até o cliente mudar).
  const [payment, setPaymentRaw] = usePersistedState("checkout:payment", isPaymentAvailable(s.settings.defaultPayment) ? s.settings.defaultPayment! : PAYMENT_FALLBACK);
  const payTouched = useRef(readUi("checkout:payment", null) !== null);
  const setPayment = (v: string) => { payTouched.current = true; setPaymentRaw(v); };
  useEffect(() => { if (!payTouched.current && isPaymentAvailable(s.settings.defaultPayment)) setPaymentRaw(s.settings.defaultPayment!); }, [s.settings.defaultPayment]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Pedido devolvido pelo servidor (id, total e itens oficiais).
  const [placed, setPlaced] = useState<ApiOrder | null>(null);
  // Uma chave por tentativa de compra: duplo clique ou repetição por rede devolvem o MESMO pedido.
  const idemKey = useRef<string>(newIdempotencyKey());
  // `inFlight` (ref, não estado) trava cliques no MESMO instante: o estado `busy` só atualiza no render seguinte.
  const inFlight = useRef(false);
  // Pedido idêntico já existente (o servidor recusa duplicados feitos há instantes e devolve o id).
  const [dupOrderId, setDupOrderId] = useState<string | null>(null);
  // Verificação de stock na Revisão: "Confirmar compra" fica bloqueado se algum produto falhar.
  const [check, setCheck] = useState<CartCheck | null>(null);
  const [checking, setChecking] = useState(false);
  const runCheck = async () => {
    setChecking(true);
    try { setCheck(await api.validateCart(Object.entries(s.cart).map(([productId, quantity]) => ({ productId, quantity })))); }
    catch { setCheck(null); } // sem resposta: não bloqueia; o servidor volta a conferir ao criar o pedido
    finally { setChecking(false); }
  };
  useEffect(() => { if (i === 3) void runCheck(); }, [i]);
  const blocked = checking || (check !== null && !check.ok);

  /** Guarda a morada escrita neste checkout na conta (opcional; falhar aqui nunca atrapalha o pedido). */
  async function saveNewAddress() {
    if (usingSaved || !saveAddr || s.addresses.length >= MAX_SAVED_ADDRESSES) return;
    if (s.addresses.some((a) => a.neighborhood === addr.neighborhood && plain(a.reference) === plain(addr.reference.trim()))) return;
    const label = s.addresses.length === 0 ? "Casa" : s.addresses.length === 1 ? "Trabalho" : `Morada ${s.addresses.length + 1}`;
    try {
      const { addresses } = await api.createAddress({ label, name: addr.name.trim(), phone: addr.phone, inCity: true, neighborhood: addr.neighborhood, reference: addr.reference.trim() });
      s.setAddresses(addresses);
    } catch { /* ignora */ }
  }
  const placeOrder = async () => {
    if (busy || inFlight.current || blocked) return; // evita cliques duplicados e pedidos sem stock garantido
    inFlight.current = true; setBusy(true); setError(""); setDupOrderId(null);
    let created = false;
    try {
      const { order } = await api.createOrder({
        items: Object.entries(s.cart).map(([productId, quantity]) => ({ productId, quantity })),
        paymentMethod: payment, shippingAddress: address.trim(), deliveryMethod: delivery, deliveryQuoteToken: addr.inCity ? deliveryQuote?.quoteToken : undefined, // o custo de entrega sai do token assinado pelo servidor
        idempotencyKey: idemKey.current,
      });
      setPlaced(order);
      s.addOrder(order); // entra já na lista de pedidos e no sino de notificações
      void saveNewAddress(); // se pediu, guarda a morada nova na conta
      s.showToast(statusInfo(order.status).notice); // "O seu pedido está a ser preparado para a entrega."
      s.clearCart(); // o pedido já existe: o carrinho não pode ficar cheio
      clearUiDrafts("checkout:"); // o rascunho do checkout já cumpriu o seu papel
      created = true; // a trava `inFlight` fica ligada: este checkout já não envia mais nenhum pedido
      setI(4);
    } catch (e) {
      // 4xx: o pedido NÃO foi criado -> a próxima tentativa usa chave nova (evita "chave já utilizada").
      // Sem resposta (0) ou 5xx: o pedido PODE ter sido criado -> mantém a MESMA chave; repetir devolve o mesmo pedido.
      if (e instanceof ApiError && e.status >= 400 && e.status < 500) idemKey.current = newIdempotencyKey();
      if (e instanceof ApiError && e.fields?.orderId) setDupOrderId(e.fields.orderId);
      if (e instanceof ApiError && e.status === 409) void runCheck(); // o stock mudou: mostra o que falhou
      if (e instanceof ApiError && e.status === 401) {
        s.setProfile(null); s.setUser(false);
        s.showToast("Sessão expirada. Inicie sessão novamente.");
        s.go("auth");
        return;
      }
      if (e instanceof ApiError && (e.status === 410 || /alcul/i.test(e.message))) {
        // Cotação em falta, expirada ou de outro bairro: o cliente tem de calcular de novo (passo da morada).
        setDeliveryQuote(null); setI(0); setError(e.message);
        return;
      }
      if (e instanceof ApiError) {
        // 400 de validação: junta as mensagens por campo (ex.: "Modalidade de entrega inválida.") à mensagem geral.
        const details = e.fields ? Object.entries(e.fields).filter(([k, v]) => k !== "orderId" && v).map(([, v]) => v).join(" ") : "";
        setError(details && !e.message.includes(details) ? `${e.message} ${details}` : e.message);
      } else {
        setError("Não foi possível criar o pedido.");
      }
    } finally { setBusy(false); if (!created) inFlight.current = false; }
  };

  // Indicador de progresso: etapas concluídas ficam marcadas, a atual fica destacada.
  const stepper = (
    <ol className="co-steps" aria-label="Etapas da compra">
      {steps.map((t, n) => {
        // Na última etapa (Confirmação) tudo fica concluído; nas outras, só as anteriores à atual.
        const done = n < i || i === steps.length - 1;
        const current = n === i && !done;
        return (
          <li key={t} className={done ? "done" : current ? "current" : ""} aria-current={current ? "step" : undefined}>
            <span className="co-dot" aria-hidden="true">{done ? <Icon d={IC.check} size={14} /> : n + 1}</span>
            <span className="co-label">{t}{done && <span className="sr-only"> (concluído)</span>}</span>
          </li>
        );
      })}
    </ol>
  );

  // Resumo do pedido (barra lateral), partilhado pelos passos Morada e Entrega.
  const summary = (
    <aside className="panel co-summary" aria-label="Resumo do pedido">
      <h3>Resumo do pedido</h3>
      <ul className="co-items">
        {Object.keys(s.cart).map((id) => { const p = byId(id); return p ? (
          <li key={id}><span className="co-item-name">{p.name}<small> × {s.cart[id]}</small></span><span>{fmt(p.price * s.cart[id])}</span></li>
        ) : null; })}
      </ul>
      <p className="sum"><span>Produtos</span><span>{fmt(cartTotal(s.cart))}</span></p>
      {addr.inCity && <p className="sum"><span>Entrega</span><span>{deliveryQuote ? `${deliveryQuote.priceMzn.toLocaleString("pt-MZ")} MT` : "A calcular"}</span></p>}
      <p className="sum total"><span>Total estimado</span><span>{fmt(cartTotal(s.cart) + (addr.inCity && deliveryQuote ? deliveryQuote.priceMzn : 0))}</span></p>
      {i >= 1 && <p className="co-note"><strong>Entrega:</strong> {delivery}</p>}
      {i >= 3 && <p className="co-note"><strong>Pagamento:</strong> {payment}</p>}
    </aside>
  );

  if (i === 0) {
    const field = (k: AddressTextKey, label: string, opts: { required?: boolean; type?: string; autoComplete?: string; maxLength?: number; inputMode?: "tel" | "numeric" | "text"; pattern?: string; clean?: (v: string) => string; capitalize?: "words" | "sentences" | "off" } = {}) => (
      <div className="co-field">
        <label htmlFor={`co-${k}`}>{label}{opts.required !== false && <span className="co-req" aria-hidden="true"> *</span>}</label>
        <input id={`co-${k}`} type={opts.type ?? "text"} inputMode={opts.inputMode} autoComplete={opts.autoComplete} maxLength={opts.maxLength ?? 80}
          pattern={opts.pattern} autoCapitalize={opts.capitalize} spellCheck={opts.type === "tel" ? false : undefined}
 value={addr[k]} onChange={(e) => setField(k, opts.clean ? opts.clean(e.target.value) : e.target.value)}
          aria-invalid={addrErrs[k] ? true : undefined} aria-describedby={addrErrs[k] ? `co-${k}-err` : undefined} />
        {addrErrs[k] && <span className="field-error" id={`co-${k}-err`} role="alert">{addrErrs[k]}</span>}
      </div>
    );
    const next = () => {
      // Exigir que o cliente escolha explicitamente uma morada guardada ou a opção de nova morada.
      if (s.addresses.length > 0 && picked === null) {
        setError("Por favor, selecione a sua morada padrão ou escolha outra morada e confirme o endereço.");
        return;
      }
      if (picked !== null && picked !== "new" && !s.addresses.some((a) => a.id === picked)) {
        setError("Esta morada já não está disponível. Selecione outra morada.");
        return;
      }
      // A morada padrão ou guardada não substitui a taxa: todos os pedidos precisam da taxa do bairro.
      if (addr.inCity && !deliveryQuote) {
        setError("Escolha o bairro e aguarde a taxa de entrega antes de continuar.");
        return;
      }
      setError("");
      const e = validateAddress(addr);
      setAddrErrs(e);
      if (Object.keys(e).length === 0) setI(1);
    };
    return <div className="co-page">
      {stepper}
      <div className="co-layout">
        <form className="panel co-form" noValidate onSubmit={(e) => { e.preventDefault(); next(); }}>
          <h2>Dados de entrega</h2>
          <p className="muted co-sub">Preencha os dados abaixo para entregarmos a sua encomenda no local certo.</p>

          {s.addresses.length > 0 && (
            <div className="co-options acc-pick" role="radiogroup" aria-label="Moradas guardadas">
              {s.addresses.map((a) => (
                <div key={a.id} className={"co-saved-address" + (picked === a.id ? " on" : "")}>
                  <label className={"co-option co-saved-option" + (picked === a.id ? " on" : "")}>
                    <input type="radio" name="saved-addr" checked={picked === a.id} onChange={() => applySaved(a)} />
                    <span className="co-radio" aria-hidden="true" />
                    <span className="co-option-body">
                      <span className="co-option-top"><strong>{a.label}</strong>{a.isDefault && <em className="co-badge">Padrão</em>}</span>
                      <span className="co-option-desc">{a.name} · {fmtPhone9(a.phone)} — {a.neighborhood}, {a.reference}</span>
                    </span>
                  </label>
                  <button type="button" className="co-address-delete" aria-label={`Eliminar morada ${a.label}`} title="Eliminar morada" onClick={() => setDeleteAddressId(a.id)}><Icon d={IC.trash} size={16} /><span>Eliminar</span></button>
                </div>
              ))}
              <label className={"co-option" + (picked === "new" ? " on" : "")}>
                <input type="radio" name="saved-addr" checked={picked === "new"} onChange={chooseNew} />
                <span className="co-radio" aria-hidden="true" />
                <span className="co-option-body">
                  <span className="co-option-top"><strong>Usar outra morada</strong></span>
                  <span className="co-option-desc">Escreva uma morada diferente para este pedido.</span>
                </span>
              </label>
            </div>
          )}
          {!usingSaved && (<>
          <fieldset className="co-group">
            <legend>Destinatário</legend>
            <p className="muted co-help">Indique o nome de quem vai receber e um telefone activo para contacto do estafeta.</p>
            <div className="co-grid">
              {field("name", "Nome", { autoComplete: "name", maxLength: 50, clean: onlyPersonName, capitalize: "words" })}
              {field("phone", "Telefone", { type: "tel", inputMode: "numeric", autoComplete: "tel-national", maxLength: 9, pattern: "[0-9]{9}", clean: onlyPhone })}
            </div>
          </fieldset>

          <fieldset className="co-group">
            <legend>Morada de entrega</legend>
            <p className="muted co-help">Indique o bairro e um ponto de referência para localizar a entrega na cidade da Beira.</p>
            <div className="co-grid">
              <div className="co-field">
                <label htmlFor="co-city">Cidade</label>
                <input id="co-city" className="co-fixed" value={DELIVERY_CITY} readOnly />
              </div>
              <div className="co-field">
                <label htmlFor="co-province">Província</label>
                <input id="co-province" className="co-fixed" value={DELIVERY_PROVINCE} readOnly />
              </div>
              <div className="co-field">
                <label htmlFor="co-neighborhood">Bairro<span className="co-req" aria-hidden="true"> *</span></label>
                <select id="co-neighborhood" value={addr.neighborhood} onChange={(e) => setField("neighborhood", e.target.value)} aria-invalid={addrErrs.neighborhood ? true : undefined} aria-describedby={addrErrs.neighborhood ? "co-neighborhood-err" : undefined}>
                  <option value="">Selecione o bairro…</option>
                  {BEIRA_ZONES.map((g) => <optgroup key={g.posto} label={g.posto}>{g.bairros.map((b) => <option key={b} value={b}>{b}</option>)}</optgroup>)}
                </select>
                {addrErrs.neighborhood && <span className="field-error" id="co-neighborhood-err" role="alert">{addrErrs.neighborhood}</span>}
              </div>
            </div>
            {field("reference", "Ponto de referência", { maxLength: 50, clean: (v) => onlyAddressText(v, 50), capitalize: "sentences" })}
            <p className="muted co-help">Obrigatório. Indique um local próximo que ajude o estafeta a encontrar a morada, como uma escola, loja ou paragem.</p>

          </fieldset>

          {s.addresses.length < MAX_SAVED_ADDRESSES && (
            <label className="acc-check"><input type="checkbox" checked={saveAddr} onChange={(e) => setSaveAddr(e.target.checked)} /><span>Guardar morada para próximas compras</span></label>
          )}
          </>)}

          <section className="my-[18px] rounded-xl border border-line bg-white p-4" aria-labelledby="co-fee-title">
            <h3 id="co-fee-title" className="mt-0 mb-0 text-[1rem] font-semibold">Taxa de entrega</h3>
            {deliveryQuote ? (
              <div className="mt-3 flex items-center justify-between gap-4 border-t border-line pt-3" aria-live="polite">
                <div className="min-w-0">
                  <div className="font-semibold">{addr.neighborhood}, {DELIVERY_CITY}</div>
                  <div className="muted text-[.84rem]">{usingSaved ? "Morada guardada · taxa fixa por bairro" : "Taxa fixa por bairro"}</div>
                </div>
                <div className="shrink-0 text-[1.25rem] font-bold">{deliveryQuote.priceMzn.toLocaleString("pt-MZ")} MT</div>
              </div>
            ) : !addr.neighborhood ? (
              <p className="muted co-help">Escolha o bairro para ver a taxa de entrega, que é fixa por bairro.</p>
            ) : null}
            {/* Continua montado (também escondido) porque é ele que calcula a taxa; só se vê enquanto calcula ou se falhar. */}
            <div className={deliveryQuote ? "hidden" : ""}>
              <DeliveryLive neighborhood={addr.neighborhood} quote={deliveryQuote} onQuote={(quote) => { setDeliveryQuote(quote); setError(""); }} />
            </div>
          </section>

          {deleteAddressId && <div className="co-delete-confirm" role="alertdialog" aria-modal="true" aria-labelledby="co-delete-title">
            <div className="co-delete-dialog">
              <h3 id="co-delete-title">Eliminar morada?</h3>
              <p>Esta morada será removida das suas moradas guardadas. Esta ação não pode ser desfeita.</p>
              <div className="co-delete-actions">
                <button type="button" className="btn ghost" disabled={deletingAddress} onClick={() => setDeleteAddressId(null)}>Cancelar</button>
                <button type="button" className="btn danger" disabled={deletingAddress} onClick={() => void deleteSavedAddress(deleteAddressId)}>{deletingAddress ? "A eliminar…" : "Sim, eliminar"}</button>
              </div>
            </div>
          </div>}

          {error && <p className="auth-err" role="alert">{error}</p>}
          <div className="co-actions">
            <button type="button" className="btn ghost" onClick={() => s.go("cart")}>Carrinho</button>
            <button type="submit" className="btn">Continuar</button>
          </div>
        </form>

        {summary}
      </div>
    </div>;
  }

  if (i === 1) return <div className="co-page">
    {stepper}
    <div className="co-layout">
      <section className="panel co-form" aria-labelledby="co-delivery-title">
        <h2 id="co-delivery-title">Método de entrega</h2>
        <p className="muted co-help">Reveja a modalidade apresentada para a morada escolhida. Se precisar de corrigir a localização, volte ao passo Morada.</p>
        <p className="muted co-sub">Confira os dados antes de prosseguir com o pedido.</p>

        <div className="co-addr-box">
          <div>
            <span className="co-addr-label">Endereço de entrega</span>
            <p className="co-addr-text">{address}</p>
            <p className="muted co-note">A entrega será organizada com base na morada e na localização confirmadas. O prazo e o custo aplicáveis serão considerados no processamento do pedido.</p>
          </div>
          <button type="button" className="link" onClick={() => setI(0)}>Alterar morada</button>
        </div>

        <div className="co-actions">
          <button type="button" className="btn ghost" onClick={() => setI(0)}>Voltar</button>
          <button type="button" className="btn" onClick={() => setI(2)}>Continuar</button>
        </div>
      </section>
      {summary}
    </div>
  </div>;

  if (i === 2) return <div className="co-page">
    {stepper}
    <div className="co-layout">
      <section className="panel co-form" aria-labelledby="co-payment-title">
        <h2 id="co-payment-title">Forma de pagamento</h2>
        <p className="muted co-sub">Selecione o método de pagamento.</p>

        <div className="co-options" role="radiogroup" aria-label="Forma de pagamento">
          {PAYMENT_OPTIONS.map((o) => (
            <label key={o.value} className={"co-option" + (payment === o.value ? " on" : "") + (o.unavailable ? " unavailable" : "")} style={o.unavailable ? { cursor: "not-allowed" } : undefined} aria-disabled={o.unavailable || undefined}>
              <input type="radio" name="payment" checked={payment === o.value} disabled={o.unavailable} onChange={() => setPayment(o.value)} />
              <span className="co-radio" aria-hidden="true" />
              <span className="co-option-body">
                <span className="co-option-top"><strong style={o.unavailable ? STRIKE : undefined}>{o.title}</strong>{o.unavailable && <em style={SOLD_OUT_BADGE}>Indisponível</em>}</span>
                <span className="co-option-desc" style={o.unavailable ? STRIKE : undefined}>{o.desc}</span>
              </span>
              <span className="co-pay-mark" aria-hidden="true" style={o.unavailable ? { opacity: 0.4, filter: "grayscale(1)" } : undefined}>
                {PAY_LOGOS[o.value] ?? (
                  <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2.5" y="6" width="19" height="12" rx="2" /><circle cx="12" cy="12" r="2.6" /><path d="M6 9.5v.01M18 14.5v.01" />
                  </svg>
                )}
              </span>
            </label>
          ))}
        </div>

        <div className="co-actions">
          <button type="button" className="btn ghost" onClick={() => setI(1)}>Voltar</button>
          <button type="button" className="btn" onClick={() => setI(3)}>Continuar</button>
        </div>
      </section>
      {summary}
    </div>
  </div>;

  if (i === 3) return <div className="co-page co-review-page">
    {stepper}
    <div className="co-layout">
      <section className="panel co-form co-review-main" aria-labelledby="co-review-title">
        <div className="co-review-heading"><span className="co-review-icon" aria-hidden="true">✓</span><div><h2 id="co-review-title">Revisão do pedido</h2><p className="muted co-sub">Confirme os dados e o valor estimado antes de finalizar a compra.</p></div></div>
        <section className="co-review-section" aria-label="Entrega">
          <div className="co-review-section-head"><h3>Dados de entrega</h3><button type="button" className="link" onClick={() => setI(0)}>Editar</button></div>
          <div className="co-review-detail"><span className="co-review-detail-icon" aria-hidden="true">⌖</span><div><strong>Morada</strong><p className="co-review-addr">{address}</p></div></div>
        </section>
        <section className="co-review-section" aria-label="Pagamento">
          <div className="co-review-section-head"><h3>Pagamento</h3><button type="button" className="link" onClick={() => setI(2)}>Editar</button></div>
          <div className="co-review-detail"><span className="co-review-detail-icon" aria-hidden="true">▤</span><div><strong>Forma de pagamento</strong><p>{payment}</p></div></div>
        </section>
        <div className="co-review-security"><span aria-hidden="true">✓</span><p>Verifique os dados acima. Ao confirmar, o seu pedido será enviado para processamento.</p></div>
        {checking && <p className="muted">A verificar stock...</p>}
        {check && !check.ok && <div role="alert" className="auth-err">{check.items.filter((it) => it.status !== "ok").map((it) => <p key={it.productId}>{it.message}</p>)}
          <button type="button" className="btn ghost" onClick={() => s.go("cart")}>Voltar ao carrinho e ajustar</button></div>}
        {error && <p className="auth-err" role="alert">{error}</p>}
        {dupOrderId && <p><button type="button" className="link" onClick={() => s.openAccount("Pedidos")}>Ver os meus pedidos</button></p>}
        <div className="co-actions"><button type="button" className="btn ghost" disabled={busy} onClick={() => setI(2)}>Voltar</button><button type="button" className="btn" disabled={busy || blocked} onClick={placeOrder}>{busy ? "A processar..." : checking ? "A verificar stock..." : "Confirmar compra"}</button></div>
      </section>
      <aside className="panel co-summary co-review-summary" aria-label="Resumo final do pedido">
        <h3>Resumo da compra</h3>
        <ul className="co-items">{Object.keys(s.cart).map((id) => { const p = byId(id); return p ? <li key={id}><span className="co-item-name">{p.name}<small> × {s.cart[id]}</small></span><strong>{fmt(p.price * s.cart[id])}</strong></li> : null; })}</ul>
        <p className="sum"><span>Subtotal dos produtos</span><span>{fmt(cartTotal(s.cart))}</span></p>
        <p className="sum"><span>Entrega</span><span>{addr.inCity && deliveryQuote ? `${deliveryQuote.priceMzn.toLocaleString("pt-MZ")} MT` : "A confirmar"}</span></p>
        <div className="co-review-total"><span>Total estimado</span><strong>{fmt(cartTotal(s.cart) + (addr.inCity && deliveryQuote ? deliveryQuote.priceMzn : 0))}</strong></div>
        <p className="co-review-summary-note">O valor da entrega está incluído no total estimado quando a tarifa já foi calculada.</p>
      </aside>
    </div>
  </div>;

  return <div className="co-page"><section className="panel co-form co-confirmed-panel">
    {stepper}
    <div className="co-confirmed-content"><span className="co-confirmed-icon" aria-hidden="true">✓</span><h2>Pedido confirmado</h2><p className="muted">O seu pedido foi registado com sucesso.</p><p><strong>Número do pedido:</strong> {placed?.id}</p>{placed && <><p className="ord-now"><StatusPill status={placed.status} /> <span>{statusInfo(placed.status).notice}</span></p><OrderTracker status={placed.status} /><ul className="co-items">{placed.items.map((it) => <li key={it.id}><span className="co-item-name">{it.name}<small> × {it.quantity}</small></span><span>{fmt(it.subtotal)}</span></li>)}</ul><p className="sum total"><span>Total do pedido</span><span>{fmt(placed.total)}</span></p></>}</div>
    <div className="co-actions"><button className="btn" onClick={() => s.openAccount("Pedidos")}>Acompanhar pedido</button><button className="btn ghost" onClick={() => s.go("home")}>Voltar à loja</button></div>
  </section></div>;
};

/* ========================================================================== */
/* Painéis da conta: Moradas, Métodos de pagamento, Definições, Ajuda, Sobre   */
/* ========================================================================== */

/** Ícones extra usados só nestes painéis (somam-se aos de `IC`). */
const AI = {
  pin: "M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0zM12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  card: "M3 6h18v12H3zM3 10h18M7 15h4",
  edit: "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z",
  plus: "M12 5v14M5 12h14",
  star: "M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.9L12 17.8 5.8 21.1 7 14.2 2 9.3l6.9-1z",
  download: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3",
  lock: "M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4",
  mail: "M3 5h18v14H3zM3 7l9 6 9-6",
  phone: "M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z",
  chat: "M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4",
  shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM9 12l2 2 4-4",
  globe: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20",
  logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
};

/** Máximo de moradas guardadas (o servidor aplica o mesmo limite). */
const MAX_SAVED_ADDRESSES = 5;
/** Preferências antes de o servidor responder (e sem sessão). */
const DEFAULT_SETTINGS: ApiSettings = { defaultPayment: null, notifyOrders: true, notifyOffers: false };
/** "841234567" -> "84 123 4567" (só para mostrar). */
const fmtPhone9 = (p: string) => p.replace(/^(\d{2})(\d{3})(\d{4})$/, "$1 $2 $3");
/** Para pesquisar sem se preocupar com acentos e maiúsculas. */
const plain = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** A sessão caducou a meio de uma ação: volta ao login com um aviso. */
const sessionLost = (s: Store) => {
  s.setProfile(null); s.setUser(false);
  s.showToast("Sessão expirada. Inicie sessão novamente.");
  s.go("auth");
};

/** Guarda preferências com efeito imediato no ecrã; se o servidor recusar, volta ao valor anterior. */
const saveSettings = async (s: Store, patch: Partial<ApiSettings>, okMsg: string): Promise<void> => {
  const prev = s.settings;
  s.setSettings({ ...prev, ...patch });
  try {
    const { settings } = await api.updateSettings(patch);
    s.setSettings(settings);
    s.showToast(okMsg);
  } catch (e) {
    s.setSettings(prev);
    if (e instanceof ApiError && e.status === 401) { sessionLost(s); return; }
    s.showToast(e instanceof ApiError ? e.message : "Não foi possível guardar. Tente novamente.");
  }
};

/** Marca da forma de pagamento (M-Pesa / e-Mola, ou o ícone genérico do pagamento na entrega). */
const PayMark = ({ value }: { value: string }) => (
  <span className="co-pay-mark" aria-hidden="true">
    {PAY_LOGOS[value] ?? (
      <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2.5" y="6" width="19" height="12" rx="2" /><circle cx="12" cy="12" r="2.6" /><path d="M6 9.5v.01M18 14.5v.01" />
      </svg>
    )}
  </span>
);

/** Interruptor liga/desliga acessível, com título e explicação. */
const Switch = ({ on, label, desc, disabled, onChange }: { on: boolean; label: string; desc: string; disabled?: boolean; onChange: (v: boolean) => void }) => (
  <div className="acc-row">
    <div className="acc-row-text"><strong>{label}</strong><span>{desc}</span></div>
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} className={`acc-switch ${on ? "on" : ""}`} onClick={() => onChange(!on)}><i /></button>
  </div>
);

/* ------------------------------------------------------------------ Moradas */

type AddrDraft = AddressForm & { label: string; makeDefault: boolean };
const LABEL_SUGGESTIONS = ["Casa", "Trabalho", "Família"];
const emptyDraft = (s: Store): AddrDraft => ({
  name: s.profile?.name ?? "", phone: (s.profile?.phone ?? "").replace(/^\+258/, ""), province: DELIVERY_PROVINCE, city: DELIVERY_CITY,
  inCity: true, neighborhood: "", street: "", reference: "", label: s.addresses.length === 0 ? "Casa" : "", makeDefault: false,
});

/**
 * Secção "Moradas": o cliente guarda até 5 moradas, edita, elimina e escolhe a padrão.
 * As moradas ficam na base de dados (/api/account/addresses) e aparecem no checkout, onde basta escolher uma.
 */
const Addresses = ({ s }: { s: Store }) => {
  const [editing, setEditing] = useState<string | null>(null); // null = fechado, "new" = nova, ou o id da morada em edição
  const [d, setD] = useState<AddrDraft>(() => emptyDraft(s));
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [workingId, setWorkingId] = useState<string | null>(null);

  if (!s.accountLoaded) return <div className="ord-skel" role="status" aria-label="A carregar as moradas"><span /><span /></div>;

  const full = s.addresses.length >= MAX_SAVED_ADDRESSES;
  const editingAddr = s.addresses.find((a) => a.id === editing);
  const setField = (k: keyof AddrDraft, v: string | boolean) => {
    setD((x) => ({ ...x, [k]: v })); setMsg("");
    if (errs[k]) setErrs((e) => { const n = { ...e }; delete n[k]; return n; });
  };


  const save = async (e: FormEvent) => {
    e.preventDefault();
    const found = validateAddress(d);
    if (!d.label.trim()) found.label = "Dê um nome à morada.";
    setErrs(found);
    if (Object.keys(found).length) return;
    setBusy(true); setMsg("");
    const body = { label: d.label.trim(), name: d.name.trim(), phone: d.phone, inCity: true, neighborhood: d.neighborhood, reference: d.reference.trim(), makeDefault: d.makeDefault };
    try {
      const { addresses } = editing === "new" ? await api.createAddress(body) : await api.updateAddress(editing!, body);
      s.setAddresses(addresses);
      s.showToast(editing === "new" ? "Morada guardada." : "Morada atualizada.");
      close();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) { sessionLost(s); return; }
      if (error instanceof ApiError && error.fields) setErrs(error.fields);
      else setMsg(error instanceof ApiError ? error.message : "Não foi possível guardar a morada.");
    } finally { setBusy(false); }
  };

  const makeDefault = async (a: ApiAddress) => {
    setWorkingId(a.id);
    try { const { addresses } = await api.setDefaultAddress(a.id); s.setAddresses(addresses); s.showToast(`"${a.label}" é agora a sua morada padrão.`); }
    catch (error) { if (error instanceof ApiError && error.status === 401) { sessionLost(s); return; } s.showToast(error instanceof ApiError ? error.message : "Não foi possível alterar a morada padrão."); }
    finally { setWorkingId(null); }
  };
  const remove = async (a: ApiAddress) => {
    setWorkingId(a.id);
    try { const { addresses } = await api.deleteAddress(a.id); s.setAddresses(addresses); setConfirmId(null); s.showToast("Morada eliminada."); }
    catch (error) { if (error instanceof ApiError && error.status === 401) { sessionLost(s); return; } s.showToast(error instanceof ApiError ? error.message : "Não foi possível eliminar a morada."); }
    finally { setWorkingId(null); }
  };

  /** Campo de texto com etiqueta, erro e acessibilidade. */
  const text = (k: "name" | "phone" | "reference" | "label" | "neighborhood", label: string, o: { required?: boolean; type?: string; inputMode?: "tel" | "numeric" | "text"; pattern?: string; autoComplete?: string; maxLength: number; clean?: (v: string) => string }) => (
    <div className="co-field">
      <label htmlFor={`ad-${k}`}>{label}{o.required !== false && <span className="co-req" aria-hidden="true"> *</span>}</label>
      <input id={`ad-${k}`} type={o.type ?? "text"} inputMode={o.inputMode} autoComplete={o.autoComplete} maxLength={o.maxLength} pattern={o.pattern}
        value={d[k]} onChange={(e) => setField(k, o.clean ? o.clean(e.target.value) : e.target.value)}
        aria-invalid={errs[k] ? true : undefined} aria-describedby={errs[k] ? `ad-${k}-err` : undefined} />
      {errs[k] && <span className="field-error" id={`ad-${k}-err`} role="alert">{errs[k]}</span>}
    </div>
  );

  return (
    <div className="acc">
      <div className="acc-bar">
        <p className="acc-count"><b>{s.addresses.length}</b> de {MAX_SAVED_ADDRESSES} moradas guardadas</p>
        {editing === null && <button type="button" className="btn acc-add" disabled={full} onClick={startNew}><Icon d={AI.plus} size={16} /> Adicionar morada</button>}
      </div>
      {full && editing === null && <p className="muted acc-note">Atingiu o limite de moradas. Elimine uma para adicionar outra.</p>}

      {editing !== null && (
        <form className="acc-form" noValidate onSubmit={save}>
          <h3>{editing === "new" ? "Nova morada" : "Editar morada"}</h3>
          <div className="co-field">
            <label htmlFor="ad-label">Nome da morada<span className="co-req" aria-hidden="true"> *</span></label>
            <input id="ad-label" maxLength={30} value={d.label} onChange={(e) => setField("label", e.target.value)}
              aria-invalid={errs.label ? true : undefined} aria-describedby={errs.label ? "ad-label-err" : undefined} />
            <div className="acc-chips">
              {LABEL_SUGGESTIONS.map((l) => <button type="button" key={l} className={`acc-chip ${d.label === l ? "on" : ""}`} onClick={() => setField("label", l)}>{l}</button>)}
            </div>
            {errs.label && <span className="field-error" id="ad-label-err" role="alert">{errs.label}</span>}
          </div>
          <div className="co-grid">
            {text("name", "Nome de quem recebe", { autoComplete: "name", maxLength: 50, clean: onlyPersonName })}
            {text("phone", "Telemóvel", { type: "tel", inputMode: "numeric", autoComplete: "tel-national", maxLength: 9, pattern: "[0-9]{9}", clean: onlyPhone })}
          </div>
          <div className="co-grid">
            <div className="co-field"><label htmlFor="ad-city">Cidade</label><input id="ad-city" className="co-fixed" value={DELIVERY_CITY} readOnly /></div>
            <div className="co-field"><label htmlFor="ad-province">Província</label><input id="ad-province" className="co-fixed" value={DELIVERY_PROVINCE} readOnly /></div>
            <div className="co-field">
              <label htmlFor="ad-neighborhood">Bairro<span className="co-req" aria-hidden="true"> *</span></label>
              <select id="ad-neighborhood" value={d.neighborhood} onChange={(e) => setField("neighborhood", e.target.value)} aria-invalid={errs.neighborhood ? true : undefined}>
                <option value="">Selecione o bairro…</option>
                {BEIRA_ZONES.map((g) => <optgroup key={g.posto} label={g.posto}>{g.bairros.map((b) => <option key={b} value={b}>{b}</option>)}</optgroup>)}
              </select>
              {errs.neighborhood && <span className="field-error" role="alert">{errs.neighborhood}</span>}
            </div>
          </div>
          {text("reference", "Ponto de referência", { maxLength: 50, clean: (v) => onlyAddressText(v, 50) })}
          {s.addresses.length > 0 && !editingAddr?.isDefault && (
            <label className="acc-check"><input type="checkbox" checked={d.makeDefault} onChange={(e) => setField("makeDefault", e.target.checked)} /> Usar como morada padrão nas próximas compras</label>
          )}
          {msg && <p className="auth-err" role="alert">{msg}</p>}
          <div className="row">
            <button type="button" className="btn ghost" onClick={close} disabled={busy}>Cancelar</button>
            <button type="submit" className="btn" disabled={busy}>{busy ? "A guardar..." : "Guardar morada"}</button>
          </div>
        </form>
      )}

      {s.addresses.length === 0 && editing === null ? (
        <div className="ord-empty">
          <span className="ord-empty-ico"><Icon d={AI.pin} size={30} /></span>
          <h3>Ainda não tem moradas guardadas</h3>
          <p className="muted">Guarde a sua morada uma vez e escolha-a num clique em cada compra.</p>
          <button type="button" className="btn" onClick={startNew}>Adicionar a primeira morada</button>
        </div>
      ) : (
        <ul className="acc-cards">
          {s.addresses.map((a) => (
            <li key={a.id} className={`acc-card ${a.isDefault ? "default" : ""} ${editing === a.id ? "editing" : ""}`}>
              <div className="acc-card-head">
                <span className="acc-card-ico"><Icon d={AI.pin} size={18} /></span>
                <strong>{a.label}</strong>
                {a.isDefault && <em className="acc-badge"><Icon d={AI.star} size={12} /> Padrão</em>}
              </div>
              <p className="acc-card-name">{a.name} · {fmtPhone9(a.phone)}</p>
              <p className="acc-card-addr">{a.neighborhood}, {DELIVERY_CITY}<br />{a.province}</p>
              <p className="acc-card-zone"><Icon d={IC.moto} size={15} /> Entrega na cidade da Beira</p>
              {a.reference && <p className="acc-card-ref">Referência: {a.reference}</p>}
              <div className="acc-card-actions">
                <button type="button" className="acc-link" onClick={() => startEdit(a)}><Icon d={AI.edit} size={15} /> Editar</button>
                {!a.isDefault && <button type="button" className="acc-link" disabled={workingId === a.id} onClick={() => makeDefault(a)}><Icon d={AI.star} size={15} /> Definir como padrão</button>}
                {confirmId === a.id ? (
                  <span className="ord-confirm">
                    <span>Eliminar esta morada?</span>
                    <button type="button" className="btn danger" disabled={workingId === a.id} onClick={() => remove(a)}>{workingId === a.id ? "A eliminar..." : "Sim, eliminar"}</button>
                    <button type="button" className="btn ghost" disabled={workingId === a.id} onClick={() => setConfirmId(null)}>Não</button>
                  </span>
                ) : (
                  <button type="button" className="acc-link danger" onClick={() => { setConfirmId(a.id); close(); }}><Icon d={IC.trash} size={15} /> Eliminar</button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

/* -------------------------------------------------------- Métodos de pagamento */

/**
 * Secção "Métodos de pagamento": o cliente escolhe a forma de pagamento preferida.
 * Fica guardada na conta (/api/account/settings) e vem já selecionada no passo Pagamento do checkout.
 */
const PaymentMethods = ({ s }: { s: Store }) => {
  const [busy, setBusy] = useState(false);
  const current = s.settings.defaultPayment;
  const choose = async (value: string | null) => {
    if (busy || value === current) return;
    setBusy(true);
    await saveSettings(s, { defaultPayment: value }, value ? `${value} definido como forma de pagamento padrão.` : "Preferência de pagamento removida.");
    setBusy(false);
  };
  if (!s.accountLoaded) return <div className="ord-skel" role="status" aria-label="A carregar"><span /><span /></div>;
  return (
    <div className="acc">
      <h3 className="acc-h3">Forma de pagamento padrão</h3>
      <div className="co-options" role="radiogroup" aria-label="Forma de pagamento padrão">
        {PAYMENT_OPTIONS.map((o) => (
          <label key={o.value} className={"co-option" + (current === o.value && !o.unavailable ? " on" : "") + (o.unavailable ? " unavailable" : "")} style={o.unavailable ? { cursor: "not-allowed" } : undefined} aria-disabled={o.unavailable || undefined}>
            <input type="radio" name="default-payment" checked={current === o.value && !o.unavailable} disabled={busy || o.unavailable} onChange={() => choose(o.value)} />
            <span className="co-radio" aria-hidden="true" />
            <span className="co-option-body">
              <span className="co-option-top"><strong style={o.unavailable ? STRIKE : undefined}>{o.title}</strong>{o.unavailable ? <em style={SOLD_OUT_BADGE}>Indisponível</em> : current === o.value && <em className="co-badge">Padrão</em>}</span>
              <span className="co-option-desc" style={o.unavailable ? STRIKE : undefined}>{o.desc}</span>
            </span>
            <span style={o.unavailable ? { opacity: 0.4, filter: "grayscale(1)", display: "inline-flex" } : { display: "contents" }}><PayMark value={o.value} /></span>
          </label>
        ))}
      </div>
      {current && <button type="button" className="acc-link" disabled={busy} onClick={() => choose(null)}>Remover preferência</button>}
      {!current && <p className="muted acc-note">Ainda não escolheu uma forma padrão. Pode escolher uma agora ou só no momento da compra.</p>}

      <div className="acc-info">
        <Icon d={IC.help} size={18} />
        <div>
          <strong>Como funciona</strong>
          <ul>
            <li>A forma escolhida aqui vem já selecionada no checkout; pode mudá-la em qualquer compra.</li>
            <li>Neste momento o pagamento não é cobrado online no site: a forma escolhida fica registada no pedido.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

/* ---------------------------------------------------------------- Definições */

/**
 * Secção "Definições": avisos, segurança, privacidade e sessão.
 * Os interruptores gravam logo na conta; "Estado dos pedidos" liga/desliga mesmo os avisos do sino.
 */
const SettingsPanel = ({ s }: { s: Store }) => {
  const [confirmClear, setConfirmClear] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!s.accountLoaded) return <div className="ord-skel" role="status" aria-label="A carregar"><span /><span /></div>;

  const toggle = async (key: "notifyOrders" | "notifyOffers", value: boolean, msg: string) => {
    setBusy(true); await saveSettings(s, key === "notifyOrders" ? { notifyOrders: value } : { notifyOffers: value }, msg); setBusy(false);
  };
  // Descarrega os dados da conta (perfil, moradas, preferências e pedidos) num ficheiro JSON.
  const exportData = () => {
    const data = { exportadoEm: new Date().toISOString(), conta: s.profile, moradas: s.addresses, definicoes: s.settings, pedidos: s.orders };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url; a.download = `nhongaexpress-dados-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    s.showToast("Dados exportados.");
  };
  // Apaga o que a loja guarda NESTE navegador (carrinho e avisos lidos). Não mexe na conta.
  const clearDevice = () => {
    try { Object.keys(localStorage).filter((k) => k.startsWith("nhongaexpress:") || k.startsWith("nx_")).forEach((k) => localStorage.removeItem(k)); } catch { /* ignora */ }
    s.clearCart(); setConfirmClear(false);
    s.showToast("Dados deste dispositivo limpos.");
  };
  const legal = (t: string) => { s.setInfo(t); s.go("info"); window.scrollTo({ top: 0 }); };

  return (
    <div className="acc">
      <section className="acc-group">
        <h3><Icon d={BELL_PATH} size={18} /> Notificações</h3>
        <Switch on={s.settings.notifyOrders} disabled={busy} label="Estado dos pedidos" desc="Avisos no sino e no ecrã quando o seu pedido muda de estado."
          onChange={(v) => toggle("notifyOrders", v, v ? "Avisos de pedidos ativados." : "Avisos de pedidos desativados.")} />
        <Switch on={s.settings.notifyOffers} disabled={busy} label="Ofertas e novidades" desc="Receber promoções e novidades da loja."
          onChange={(v) => toggle("notifyOffers", v, v ? "Vai receber ofertas e novidades." : "Deixou de receber ofertas e novidades.")} />
      </section>

      <section className="acc-group">
        <h3><Icon d={AI.lock} size={18} /> Segurança</h3>
        <div className="acc-row">
          <div className="acc-row-text"><strong>Palavra-passe</strong><span>Altere-a regularmente para manter a conta segura.</span></div>
          <button type="button" className="btn ghost" onClick={() => s.openAccount("Informações do perfil", undefined, "password")}>Alterar</button>
        </div>
      </section>

      <section className="acc-group">
        <h3><Icon d={AI.globe} size={18} /> Idioma e região</h3>
        <div className="acc-row">
          <div className="acc-row-text"><strong>Idioma</strong><span>Outros idiomas estarão disponíveis em breve.</span></div>
          <span className="acc-value">Português (Moçambique)</span>
        </div>
        <div className="acc-row">
          <div className="acc-row-text"><strong>Moeda</strong><span>Os preços são apresentados em Meticais.</span></div>
          <span className="acc-value">MT</span>
        </div>
      </section>

      <section className="acc-group">
        <h3><Icon d={AI.shield} size={18} /> Privacidade e dados</h3>
        <div className="acc-row">
          <div className="acc-row-text"><strong>Exportar os meus dados</strong><span>Descarregue uma cópia do seu perfil, moradas, preferências e pedidos.</span></div>
          <button type="button" className="btn ghost" onClick={exportData}><Icon d={AI.download} size={16} /> Exportar</button>
        </div>
        <div className="acc-row">
          <div className="acc-row-text"><strong>Limpar dados deste dispositivo</strong><span>Esvazia o carrinho e os avisos lidos guardados neste navegador. A sua conta não é afetada.</span></div>
          {confirmClear ? (
            <span className="ord-confirm"><button type="button" className="btn danger" onClick={clearDevice}>Sim, limpar</button><button type="button" className="btn ghost" onClick={() => setConfirmClear(false)}>Não</button></span>
          ) : <button type="button" className="btn ghost" onClick={() => setConfirmClear(true)}><Icon d={IC.trash} size={16} /> Limpar</button>}
        </div>
        <div className="acc-links">
          <button type="button" className="acc-link" onClick={() => legal("Política de privacidade")}>Política de privacidade</button>
          <button type="button" className="acc-link" onClick={() => legal("Termos de uso")}>Termos de uso</button>
        </div>
      </section>

      <section className="acc-group">
        <h3><Icon d={AI.logout} size={18} /> Sessão</h3>
        <div className="acc-row">
          <div className="acc-row-text"><strong>Terminar sessão</strong><span>Sai da conta neste dispositivo.</span></div>
          <button type="button" className="btn ghost" onClick={() => { api.logout().catch(() => {}); s.setUser(false); s.setProfile(null); s.dismissWelcome(); s.go("home"); }}>Terminar sessão</button>
        </div>
      </section>
    </div>
  );
};

/* ---------------------------------------------------------- Ajuda e suporte */

/** Assuntos do formulário de contacto. */
const HELP_TOPICS = ["Pedido atrasado", "Produto com defeito ou diferente", "Alterar ou cancelar pedido", "Pagamento", "Outro assunto"];

/**
 * Secção "Ajuda e suporte": pesquisa nas perguntas frequentes, canais de contacto (telefone, WhatsApp, e-mail)
 * e um formulário que abre o WhatsApp/e-mail já com a mensagem escrita e o pedido indicado.
 */
const HelpCenter = ({ s }: { s: Store }) => {
  const [q, setQ] = useState("");
  const [topic, setTopic] = useState(HELP_TOPICS[0]);
  const [orderId, setOrderId] = useState("");
  const [body, setBody] = useState("");
  const [err, setErr] = useState("");
  const results = faq.filter(([question, answer]) => plain(question + " " + answer).includes(plain(q.trim())));
  const canWrite = Boolean(company.whatsapp || company.email);
  const order = s.orders.find((o) => o.id === orderId);

  const message = () => [
    `Olá, sou ${s.profile?.name ?? "cliente"} da NhongaExpress.`,
    `Assunto: ${topic}`,
    order ? `Pedido: ${shortId(order.id)} (${order.id})` : "",
    body.trim(),
  ].filter(Boolean).join("\n");
  const valid = () => { if (body.trim().length < 5) { setErr("Descreva brevemente o que precisa (mínimo 5 caracteres)."); return false; } setErr(""); return true; };
  const sendWhatsApp = () => { if (valid()) window.open(`https://wa.me/${company.whatsapp}?text=${encodeURIComponent(message())}`, "_blank", "noopener,noreferrer"); };
  const sendEmail = () => { if (valid()) window.location.href = `mailto:${company.email}?subject=${encodeURIComponent(topic + (order ? ` — pedido ${shortId(order.id)}` : ""))}&body=${encodeURIComponent(message())}`; };
  const info = (t: string) => { s.setInfo(t); s.go("info"); window.scrollTo({ top: 0 }); };

  return (
    <div className="acc">
      {(company.phone || company.whatsapp || company.email || company.hours) && (
        <div className="acc-contacts">
          {company.phone && <a className="acc-contact" href={`tel:${company.phone.replace(/\s/g, "")}`}><span><Icon d={AI.phone} size={20} /></span><div><small>Telefone</small><strong>{company.phone}</strong></div></a>}
          {company.whatsapp && <a className="acc-contact" href={`https://wa.me/${company.whatsapp}`} target="_blank" rel="noopener noreferrer"><span><Icon d={AI.chat} size={20} /></span><div><small>WhatsApp</small><strong>Enviar mensagem</strong></div></a>}
          {company.email && <a className="acc-contact" href={`mailto:${company.email}`}><span><Icon d={AI.mail} size={20} /></span><div><small>E-mail</small><strong>{company.email}</strong></div></a>}
          {company.hours && <div className="acc-contact static"><span><Icon d={IC.clock} size={20} /></span><div><small>Horário</small><strong>{company.hours}</strong></div></div>}
        </div>
      )}

      <section className="acc-group">
        <h3><Icon d={IC.help} size={18} /> Perguntas frequentes</h3>
        <div className="acc-search">
          <Icon d={AI.search} size={16} />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pesquisar nas perguntas frequentes…" aria-label="Pesquisar nas perguntas frequentes" maxLength={80} />
        </div>
        {results.length === 0 ? <p className="muted acc-note">Nenhuma pergunta encontrada para "{q}". Escreva-nos abaixo e ajudamos.</p> : (
          <div className="acc-faq">
            {results.map(([question, answer]) => (
              <details key={question}><summary>{question}<Icon d={IC.chevron} size={18} /></summary><p>{answer}</p></details>
            ))}
          </div>
        )}
      </section>

      {canWrite && (
        <section className="acc-group">
          <h3><Icon d={AI.chat} size={18} /> Falar com o suporte</h3>
          <div className="co-grid">
            <div className="co-field">
              <label htmlFor="hp-topic">Assunto</label>
              <select id="hp-topic" value={topic} onChange={(e) => setTopic(e.target.value)}>{HELP_TOPICS.map((t) => <option key={t}>{t}</option>)}</select>
            </div>
            <div className="co-field">
              <label htmlFor="hp-order">Pedido (opcional)</label>
              <select id="hp-order" value={orderId} onChange={(e) => setOrderId(e.target.value)}>
                <option value="">Nenhum pedido em especial</option>
                {s.orders.map((o) => <option key={o.id} value={o.id}>{shortId(o.id)} · {statusInfo(o.status).label} · {fmt(o.total)}</option>)}
              </select>
            </div>
          </div>
          <div className="co-field">
            <label htmlFor="hp-body">Mensagem<span className="co-req" aria-hidden="true"> *</span></label>
            <textarea id="hp-body" rows={4} maxLength={600} value={body} onChange={(e) => { setBody(e.target.value); setErr(""); }} aria-invalid={err ? true : undefined} />
            {err && <span className="field-error" role="alert">{err}</span>}
          </div>
          <div className="row">
            {company.whatsapp && <button type="button" className="btn" onClick={sendWhatsApp}><Icon d={AI.chat} size={16} /> Enviar por WhatsApp</button>}
            {company.email && <button type="button" className="btn ghost" onClick={sendEmail}><Icon d={AI.mail} size={16} /> Enviar por e-mail</button>}
          </div>
          <p className="muted acc-note">A mensagem abre no WhatsApp ou no seu e-mail, já escrita; só tem de a enviar.</p>
        </section>
      )}

      <section className="acc-group">
        <h3>Mais informação</h3>
        <div className="acc-links wrap">
          {["Entregas", "Pagamentos", "Trocas e devoluções", "Termos de uso", "Política de privacidade"].map((t) => <button key={t} type="button" className="acc-chip" onClick={() => info(t)}>{t}</button>)}
        </div>
      </section>
    </div>
  );
};

/* ------------------------------------------------------------------ Sobre nós */

/** Secção "Sobre nós" da conta: resumo da loja, contactos, redes sociais e atalhos para a página completa. */
const AboutPanel = ({ s }: { s: Store }) => {
  const points = [
    { icon: IC.moto, title: "Entrega rápida", text: "Dentro da cidade em 45 minutos; fora da cidade em 1 hora e 30 minutos." },
    { icon: AI.shield, title: "Compra segura", text: "Uma experiência simples, transparente e com atenção aos seus dados." },
    { icon: AI.card, title: "Pagamento flexível", text: "M-Pesa, e-Mola ou pagamento na entrega." },
    { icon: IC.help, title: "Suporte próximo", text: "Ajuda com dúvidas, pedidos, entregas e devoluções." },
  ];
  const links = socials.filter((x) => x.href);
  const info = (t: string) => { s.setInfo(t); s.go("info"); window.scrollTo({ top: 0 }); };
  return (
    <div className="acc">
      <div className="acc-about-hero">
        <span className="eyebrow">NHONGAEXPRESS</span>
        <h3>Produtos úteis, entregues na Beira</h3>
        <p>A NhongaExpress é uma loja online de acessórios e tecnologia: telemóveis, áudio, computadores, energia, internet, automóveis, fotografia e gadgets. O nosso objetivo é oferecer produtos úteis, a bom preço e com entrega rápida.</p>
        <p className="acc-coverage"><Icon d={AI.pin} size={15} /> Entregamos dentro da cidade da Beira (45 minutos) e fora da cidade (1 hora e 30 minutos).</p>
      </div>

      <div className="acc-points">
        {points.map((x) => (
          <article key={x.title}><span><Icon d={x.icon} size={20} /></span><div><strong>{x.title}</strong><p>{x.text}</p></div></article>
        ))}
      </div>

      {(company.phone || company.email || company.address || company.hours || links.length > 0) && (
        <section className="acc-group">
          <h3>Contactos</h3>
          <ul className="acc-list">
            {company.phone && <li><Icon d={AI.phone} size={16} /><a href={`tel:${company.phone.replace(/\s/g, "")}`}>{company.phone}</a></li>}
            {company.email && <li><Icon d={AI.mail} size={16} /><a href={`mailto:${company.email}`}>{company.email}</a></li>}
            {company.address && <li><Icon d={AI.pin} size={16} /><span>{company.address}</span></li>}
            {company.hours && <li><Icon d={IC.clock} size={16} /><span>{company.hours}</span></li>}
          </ul>
          {links.length > 0 && (
            <div className="acc-social">
              {links.map((x) => <a key={x.name} href={x.href} target="_blank" rel="noopener noreferrer" aria-label={x.name} title={x.name}><Ico size={18}>{x.icon}</Ico></a>)}
            </div>
          )}
        </section>
      )}

      <div className="row">
        <button type="button" className="btn" onClick={() => { s.go("about"); window.scrollTo({ top: 0 }); }}>Ver página completa</button>
        <button type="button" className="btn ghost" onClick={() => info("Termos de uso")}>Termos de uso</button>
        <button type="button" className="btn ghost" onClick={() => info("Política de privacidade")}>Política de privacidade</button>
      </div>
      <p className="muted acc-copy">© {new Date().getFullYear()} NhongaExpress. Todos os direitos reservados.</p>
    </div>
  );
};

// Secções da área de conta e respetiva descrição (mostrada por baixo do título).
const sections: Record<string, string> = {
  "Informações do perfil": "Nome, e-mail, telefone e foto.", "Pedidos": "Acompanhe o estado dos seus pedidos.",
  "Moradas": "Guarde as suas moradas de entrega e escolha a padrão.", "Métodos de pagamento": "Escolha a forma de pagamento que prefere usar.",
  "Definições": "Notificações, segurança, idioma e privacidade.", "Ajuda e suporte": "Perguntas frequentes e contacto com a nossa equipa.", "Sobre nós": "Conheça a NhongaExpress.",
};
/** Iniciais para o avatar (ex.: "Felizardo Lázaro Matola" -> "FM"). */
const initials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
};
// "+258841234567" -> "+258 84 123 4567" (só para mostrar; o valor guardado não muda).
const showPhone = (p: string | null) => (p ? p.replace(/^\+258(\d{2})(\d{3})(\d{4})$/, "+258 $1 $2 $3") : "");
const memberSince = (iso: string) => new Date(iso).toLocaleDateString("pt-PT", { day: "numeric", month: "long", year: "numeric" });

/**
 * Secção "Informações do perfil": mostra os dados da conta e deixa alterar nome, e-mail,
 * telefone e palavra-passe. Tudo é validado outra vez no servidor (PATCH /auth/me e
 * POST /auth/change-password); os erros por campo aparecem junto a cada input.
 */
const Profile = ({ s }: { s: Store }) => {
  const u = s.profile;
  const [editing, setEditing] = useState(false);
  const [f, setF] = useState<ProfileForm>({ name: "", email: "", phone: "" });
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState<PasswordForm>({ cur: "", next: "", next2: "" });
  const [pwErrs, setPwErrs] = useState<Record<string, string>>({});
  const [pwBusy, setPwBusy] = useState(false);
  // Vindo de Definições > Segurança: abre logo o formulário de palavra-passe.
  useEffect(() => { if (s.accountTarget.focus === "password") setPwOpen(true); }, [s.accountTarget]);

  // Sem sessão (ou sessão ainda não carregada): não há conta para mostrar.
  if (!u) return <p className="muted">Não há dados de conta para mostrar. Inicie sessão para ver e editar o seu perfil.</p>;

  const startEdit = () => { setF({ name: u.name, email: u.email ?? "", phone: (u.phone ?? "").replace(/^\+258/, "") }); setErrs({}); setMsg(""); setEditing(true); };
  const onF = (k: keyof ProfileForm, clean: (v: string) => string = (v) => v) => (e: ChangeEvent<HTMLInputElement>) => { setF({ ...f, [k]: clean(e.target.value) }); setErrs({ ...errs, [k]: "" }); setMsg(""); };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (f.name.trim().length < 2) next.name = "Indique o seu nome completo.";
    if (!f.email.trim()) next.email = "O e-mail é obrigatório (é usado para recuperar a palavra-passe).";
    else if (!EMAIL_RE.test(f.email.trim())) next.email = "E-mail inválido. Use o formato nome@dominio.com.";
    if (f.phone.trim() && !PHONE_RE.test(f.phone)) next.phone = "Escreva 9 dígitos, a começar por 82–87.";
    setErrs(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      // Envia só o que mudou (comparando com os dados atuais).
      const body: { name?: string; email?: string; phone?: string } = {};
      if (f.name.trim() !== u.name) body.name = f.name.trim();
      if (f.email.trim().toLowerCase() !== (u.email ?? "")) body.email = f.email.trim();
      if (normPhone(f.phone) !== (u.phone ?? "")) body.phone = normPhone(f.phone);
      if (!Object.keys(body).length) { setEditing(false); return; }
      const { user } = await api.updateProfile(body);
      s.setProfile(user);
      s.showToast("Perfil atualizado.");
      setEditing(false);
    } catch (error) {
      if (error instanceof ApiError && error.fields) setErrs({ name: error.fields.name ?? "", email: error.fields.email ?? "", phone: error.fields.phone ?? "" });
      else setMsg(error instanceof ApiError ? error.message : "Ocorreu um erro. Tente novamente.");
    } finally { setBusy(false); }
  };

  const savePw = async (e: FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!pw.cur) next.cur = "Insira a palavra-passe atual.";
    if (pw.next.length < 8) next.next = "Use pelo menos 8 caracteres.";
    else if (!(/[A-Za-z]/.test(pw.next) && /\d/.test(pw.next))) next.next = "Use letras e pelo menos um número.";
    if (pw.next !== pw.next2) next.next2 = "As palavras-passe não coincidem.";
    setPwErrs(next);
    if (Object.keys(next).length) return;
    setPwBusy(true);
    try {
      await api.changePassword({ currentPassword: pw.cur, newPassword: pw.next });
      s.showToast("Palavra-passe alterada.");
      setPw({ cur: "", next: "", next2: "" }); setPwOpen(false);
    } catch (error) {
      if (error instanceof ApiError && error.fields) setPwErrs({ cur: error.fields.currentPassword ?? "", next: error.fields.newPassword ?? "" });
      else setPwErrs({ cur: error instanceof ApiError ? error.message : "Ocorreu um erro. Tente novamente." });
    } finally { setPwBusy(false); }
  };

  return (
    <div className="profile">
      <div className="profile-head">
        <span className="avatar" aria-hidden="true">{initials(u.name)}</span>
        <div><strong>{u.name}</strong><small className="muted">Cliente desde {memberSince(u.createdAt)}</small></div>
      </div>

      {!editing ? (
        <>
          <dl className="profile-list">
            <div><dt>Nome completo</dt><dd>{u.name}</dd></div>
            <div><dt>E-mail</dt><dd>{u.email ?? <span className="muted">Não indicado</span>}</dd></div>
            <div><dt>Telefone</dt><dd>{u.phone ? showPhone(u.phone) : <span className="muted">Não indicado</span>}</dd></div>
            <div><dt>Palavra-passe</dt><dd>••••••••</dd></div>
            <div><dt>Conta criada em</dt><dd>{memberSince(u.createdAt)}</dd></div>
          </dl>
          <div className="row">
            <button type="button" className="btn" onClick={startEdit}>Editar perfil</button>
            <button type="button" className="btn ghost" onClick={() => { setPwOpen(!pwOpen); setPwErrs({}); }}>Alterar palavra-passe</button>
          </div>
        </>
      ) : (
        <form className="profile-form" onSubmit={save} noValidate>
          <div className="field"><label htmlFor="pf-name">Nome completo</label><input id="pf-name" {...FIELD.name} value={f.name} onChange={onF("name", onlyName)} aria-invalid={!!errs.name} />{errs.name && <small className="field-error">{errs.name}</small>}</div>
          <div className="field"><label htmlFor="pf-email">E-mail</label><input id="pf-email" {...FIELD.email} value={f.email} onChange={onF("email")} aria-invalid={!!errs.email} />{errs.email && <small className="field-error">{errs.email}</small>}</div>
          <div className="field"><label htmlFor="pf-phone">Telefone (opcional)</label><input id="pf-phone" {...FIELD.phone} value={f.phone} onChange={onF("phone", onlyPhone)} aria-invalid={!!errs.phone} />{errs.phone && <small className="field-error">{errs.phone}</small>}</div>
          {msg && <p className="auth-err" role="alert">{msg}</p>}
          <div className="row">
            <button type="button" className="btn ghost" onClick={() => setEditing(false)} disabled={busy}>Cancelar</button>
            <button type="submit" className="btn" disabled={busy}>{busy ? "A guardar..." : "Guardar alterações"}</button>
          </div>
        </form>
      )}

      {pwOpen && !editing && (
        <form className="profile-form profile-pw" onSubmit={savePw} noValidate>
          <h3>Alterar palavra-passe</h3>
          <div className="field"><label htmlFor="pw-cur">Palavra-passe atual</label><input id="pw-cur" maxLength={128} type="password" autoComplete="current-password" value={pw.cur} onChange={(e) => { setPw({ ...pw, cur: e.target.value }); setPwErrs({ ...pwErrs, cur: "" }); }} aria-invalid={!!pwErrs.cur} />{pwErrs.cur && <small className="field-error">{pwErrs.cur}</small>}</div>
          <div className="field"><label htmlFor="pw-new">Nova palavra-passe</label><input id="pw-new" maxLength={128} type="password" autoComplete="new-password" value={pw.next} onChange={(e) => { setPw({ ...pw, next: e.target.value }); setPwErrs({ ...pwErrs, next: "" }); }} aria-invalid={!!pwErrs.next} />{pwErrs.next && <small className="field-error">{pwErrs.next}</small>}</div>
          <div className="field"><label htmlFor="pw-new2">Confirmar nova palavra-passe</label><input id="pw-new2" maxLength={128} type="password" autoComplete="new-password" value={pw.next2} onChange={(e) => { setPw({ ...pw, next2: e.target.value }); setPwErrs({ ...pwErrs, next2: "" }); }} aria-invalid={!!pwErrs.next2} />{pwErrs.next2 && <small className="field-error">{pwErrs.next2}</small>}</div>
          <div className="row">
            <button type="button" className="btn ghost" onClick={() => setPwOpen(false)} disabled={pwBusy}>Cancelar</button>
            <button type="submit" className="btn" disabled={pwBusy}>{pwBusy ? "A guardar..." : "Guardar palavra-passe"}</button>
          </div>
        </form>
      )}
    </div>
  );
};

// Área de conta: menu lateral com as secções acima; "Terminar sessão" volta ao login.
const Account = ({ s }: { s: Store }) => {
  const [sec, setSec] = useState(s.accountTarget.sec);
  // Se o utilizador escolher outra opção no sino enquanto já está na conta, a secção acompanha.
  useEffect(() => { setSec(s.accountTarget.sec); }, [s.accountTarget]);
  return (
    <div className="split">
      <aside>{Object.keys(sections).map((k) => <button key={k} className={sec === k ? "on" : ""} onClick={() => { setSec(k); s.setAccountSec(k); }}>{k}</button>)}
        {s.profile?.role === "admin" && <button onClick={() => window.location.assign(ADMIN_BASE)}>Painel administrativo</button>}
        <button onClick={() => { api.logout().catch(() => {}); s.setUser(false); s.setProfile(null); s.dismissWelcome(); s.go("home"); }}>Terminar sessão</button></aside>
      <div className="panel"><h2>{sec}</h2>
        {sec !== "Informações do perfil" && sec !== "Pedidos" && <p className="muted acc-sub">{sections[sec]}</p>}
        {sec === "Informações do perfil" ? <Profile s={s} />
          : sec === "Pedidos" ? <Orders s={s} />
          : sec === "Moradas" ? <Addresses s={s} />
          : sec === "Métodos de pagamento" ? <PaymentMethods s={s} />
          : sec === "Definições" ? <SettingsPanel s={s} />
          : sec === "Ajuda e suporte" ? <HelpCenter s={s} />
          : <AboutPanel s={s} />}
      </div>
    </div>
  );
};

// Perguntas frequentes (pares [pergunta, resposta]).
const faq: [string, string][] = [
  ["Como faço uma compra?", "Adicione os produtos ao carrinho, clique em Finalizar compra e siga os passos: morada, entrega, pagamento e revisão."],
  ["Onde uso o cupão de desconto?", "No carrinho, no campo Cupão do resumo do pedido."],
  ["Para onde entregam?", "Entregamos dentro da cidade da Beira e fora da cidade. No passo Morada do checkout escolhe se a morada fica dentro ou fora da cidade e indica a zona."],
  ["Quanto tempo demora a entrega?", "Dentro da cidade a entrega é Expresso, em cerca de 45 minutos. Fora da cidade chega em cerca de 1 hora e 30 minutos. A modalidade é definida pela zona da morada."],
  ["Que formas de pagamento posso usar?", "M-Pesa, e-Mola ou pagamento na entrega. Pode definir uma forma padrão em Conta → Métodos de pagamento."],
  ["Como acompanho o meu pedido?", "Em Conta → Pedidos vê o estado e a linha do tempo de cada pedido. O sino de notificações também avisa quando o estado muda."],
  ["Posso cancelar um pedido?", "Sim, enquanto ele ainda está a ser preparado: abra o pedido em Conta → Pedidos e escolha Cancelar pedido. Depois disso, fale com o suporte."],
  ["Como guardo ou altero a minha morada?", "Em Conta → Moradas pode guardar até 5 moradas, editá-las, eliminá-las e escolher a padrão. No checkout basta escolher uma delas."],
  ["O produto chegou com defeito. E agora?", "Contacte-nos com o número do pedido e fotografias. Analisaremos o caso e indicaremos a troca ou o reembolso."],
  ["Preciso de ajuda com um pedido.", "Fale connosco através de Conta → Ajuda e suporte ou da página Contacto, indicando o número do pedido."],
];
// Aviso reutilizável para textos legais ainda provisórios.
const draft = <p className="muted">Texto provisório. Substitua pelo texto legal definitivo da loja.</p>;
/**
 * Conteúdo das páginas informativas, indexado pelo título.
 * A página Info escolhe o tópico a mostrar com base em `s.info`.
 */
const topics: Record<string, JSX.Element> = {
  "Sobre nós": <p>A NhongaExpress é uma loja online de acessórios e tecnologia: telemóveis, áudio, computadores, energia, internet, automóveis, fotografia e gadgets. O nosso objetivo é oferecer produtos úteis, a bom preço e com entrega rápida. Entregamos na cidade da Beira e fora dela.</p>,
  "Central de ajuda": <>{faq.map(([q, a]) => <div key={q}><h4>{q}</h4><p className="muted">{a}</p></div>)}</>,
  "Entregas": <><p>A modalidade de entrega depende da zona da morada que indicar ao finalizar a compra:</p><ul><li>Dentro da cidade da Beira: Expresso, em cerca de 45 minutos</li><li>Fora da cidade: em cerca de 1 hora e 30 minutos</li></ul></>,
  "Pagamentos": <><p>Aceitamos as seguintes formas de pagamento:</p><ul><li className="pay-li">{PAY_LOGOS["M-Pesa"]}{PAY_LOGOS["e-Mola"]}{PAY_LOGOS["Pagamento na entrega"]}</li><li>Pagamento na entrega: pague quando receber a sua compra.</li></ul></>,
  "Trocas e devoluções": <p>Se o produto chegar com defeito, danificado ou diferente do que encomendou, contacte-nos com o número do pedido e fotografias. Analisaremos o caso e indicaremos a troca ou o reembolso.</p>,
  "Contacto": <ul>{company.phone && <li>Telefone: <a href={`tel:${company.phone.replace(/\s/g, "")}`}>{company.phone}</a></li>}{company.whatsapp && <li>WhatsApp: <a href={`https://wa.me/${company.whatsapp}`}>{company.whatsappLabel || company.phone || "Enviar mensagem"}</a></li>}{company.email && <li>E-mail: <a href={`mailto:${company.email}`}>{company.email}</a></li>}{company.hours && <li>Horário: {company.hours}</li>}{!company.phone && !company.whatsapp && !company.email && <li>Contactos disponíveis em breve.</li>}</ul>,
  "Termos de uso": <><p>Ao utilizar a NhongaExpress, aceita as condições de compra, entrega, pagamento e devolução aplicáveis aos produtos da loja.</p>{draft}</>,
  "Política de privacidade": <><p>Recolhemos apenas os dados necessários para processar os seus pedidos e melhorar a sua experiência. Não vendemos os seus dados a terceiros.</p>{draft}</>,
};

/**
 * Página "Sobre nós": história, missão e vantagens da loja.
 */
const About = ({ s }: { s: Store }) => {
  // Vantagens apresentadas como cartões; `icon` guarda o desenho SVG (atributo `d` do path).
  const highlights = [
    { title: "Entrega rápida", text: "Entregamos dentro da cidade em 45 minutos e fora da cidade em 1 hora e 30 minutos.", icon: MOTO_PATH },
    { title: "Compra segura", text: "Uma experiência simples, transparente e com atenção à proteção dos seus dados.", icon: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM9 12l2 2 4-4" },
    { title: "Pagamento flexível", text: "Escolha entre as formas de pagamento disponíveis no momento da compra.", icon: "M3 6h18v12H3zM3 10h18M7 15h4" },
    { title: "Suporte próximo", text: "Estamos disponíveis para ajudar com dúvidas, pedidos, entregas e devoluções.", icon: "M3 14v-2a9 9 0 0 1 18 0v2M21 15a2 2 0 0 1-2 2h-1v-6h1a2 2 0 0 1 2 2zM3 15a2 2 0 0 0 2 2h1v-6H5a2 2 0 0 0-2 2z" },
  ];
  return (
    <div className="about-page">
      <section className="about-hero">
        <div className="about-hero-copy">
          <span className="eyebrow">NHONGAEXPRESS</span>
          <h1>Sobre a NhongaExpress</h1>
          <p>Uma loja online da Beira, criada para aproximar produtos, tecnologia e soluções úteis das pessoas, com uma experiência de compra simples e confiável.</p>
          <p className="about-coverage">Entregamos dentro da cidade da Beira (45 minutos) e fora da cidade (1 hora e 30 minutos).</p>
          <button className="btn" onClick={() => s.go("categories")}>Explorar produtos</button>
        </div>
        <div className="about-visual" aria-label="Ilustração da NhongaExpress">
          <div className="about-orb orb-one" /><div className="about-orb orb-two" />
          <div className="about-device">
            <div className="about-device-top"><span>Nhonga</span><b>Express</b></div>
            <div className="about-device-screen"><span>Compra fácil</span><strong>Entrega na Beira</strong><i>Concluído</i></div>
          </div>
          <div className="about-box">NHONGA<br/><strong>EXPRESS</strong></div>
        </div>
      </section>

      <section className="about-story">
        <div><span className="eyebrow">Quem somos</span><h2>Feitos para tornar a compra mais simples</h2></div>
        <div><p>A NhongaExpress é uma loja online de acessórios e tecnologia, com produtos para diferentes necessidades: áudio, computadores, energia, internet, automóveis, fotografia, gadgets e muito mais.</p><p>Queremos reunir variedade, preço competitivo, facilidade de compra e atendimento próximo numa única experiência.</p><p>Entregamos dentro e fora da cidade da Beira, sempre com entregas rápidas e um atendimento mais próximo dos nossos clientes.</p></div>
      </section>

      <section className="about-mission">
        <div className="about-mission-card"><span className="eyebrow">Nossa missão</span><h2>Conectar pessoas a produtos úteis, de forma rápida e transparente.</h2><p>Trabalhamos para que cada etapa — descobrir, escolher, pagar, receber e pedir ajuda — seja clara e conveniente.</p></div>
      </section>

      <section className="about-benefits">
        <div className="about-section-head"><span className="eyebrow">Por que comprar connosco?</span><h2>Uma experiência pensada para si</h2></div>
        <div className="about-benefit-grid">
          {highlights.map((x) => <article className="about-benefit" key={x.title}><span className="about-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={x.icon}/></svg></span><h3>{x.title}</h3><p>{x.text}</p></article>)}
        </div>
      </section>

      <section className="about-cta"><div><h2>Pronto para conhecer a NhongaExpress?</h2><p>Descubra produtos e encontre o que precisa para o seu dia a dia.</p></div><button className="btn" onClick={() => s.go("categories")}>Ver produtos</button></section>
    </div>
  );
};

/**
 * Página informativa com menu lateral (ajuda, entregas, pagamentos, termos...).
 */
const Info = ({ s }: { s: Store }) => {
  // Se o título pedido não existir em `topics`, usa "Sobre nós" como alternativa.
  const t = s.info in topics ? s.info : "Sobre nós";
  return (
    <div className="split">
      <aside>{Object.keys(topics).map((k) => <button key={k} className={t === k ? "on" : ""} onClick={() => s.setInfo(k)}>{k}</button>)}</aside>
      <div className="panel"><h2>{t}</h2>{topics[t]}</div>
    </div>
  );
};

/* ========================================================================== */
/* 3. APP (componente raiz)                                                   */
/* ========================================================================== */

/* ========================================================================== */
/* CONFIGURAÇÃO DA NAVEGAÇÃO                                                  */
/* ========================================================================== */
/* A navegação usa apenas ícones no cabeçalho. Os nomes continuam disponíveis
   através de aria-label e title para acessibilidade e usabilidade. */
/* "bell" é o sino de notificações: ocupa o lugar que era do coração (lista de desejos).
   A lista de desejos continua acessível no menu móvel, na barra inferior e no rodapé. */
const nav: (Page | "bell")[] = [
  "home",
  "categories",
  "wishlist",
  "bell",
  "cart",
];

/* Ícone do sino. */
const SETTINGS_PATH = "M4 7h9M17 7h3M4 17h3M11 17h9M15 4v6M9 14v6";
const BELL_PATH = "M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0";

/* ========================================================================== */
/* RÓTULOS ACESSÍVEIS                                                          */
/* ========================================================================== */
/* Estes textos não são apresentados visualmente, mas identificam cada ação
   para leitores de ecrã e para o tooltip nativo do navegador. */
const navLabels: Record<Page, string> = {
  home: "Início",
  categories: "Categorias",
  search: "Pesquisa",
  wishlist: "Lista de desejos",
  account: "Conta",
  cart: "Carrinho",
  auth: "Autenticação",
  checkout: "Finalizar compra",
  info: "Informações",
  about: "Sobre nós",
  product: "Detalhe do produto",
};

/* Rótulos curtos da navegação inferior móvel. */
const mobileLabels: Partial<Record<Page, string>> = {
  wishlist: "Favoritos",
  account: "Conta",
};

/* ========================================================================== */
/* PLACEHOLDER ANIMADO DA PESQUISA                                            */
/* ========================================================================== */
/**
 * Placeholder animado da pesquisa: alterna entre as categorias da loja com uma transição
 * vertical (a palavra sai por cima e a seguinte entra por baixo). Só aparece com o campo vazio.
 */
function SearchHint({ items }: { items: string[] }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (items.length < 2) return;
    const id = window.setInterval(() => setI((n) => (n + 1) % items.length), 3800);
    return () => window.clearInterval(id);
  }, [items.length]);
  if (!items.length) return null;
  return (
    <span className="hsearch-hint" aria-hidden="true">
      <span className="hsearch-hint-static">Pesquisar em</span>
      <span className="hsearch-hint-slot">
        {/* A `key` força o React a recriar o elemento e repetir a animação a cada troca. */}
        <span key={i} className="hsearch-hint-word">{items[i]}</span>
      </span>
    </span>
  );
}

/* ========================================================================== */
/* COMPONENTE DE ÍCONE SVG                                                    */
/* ========================================================================== */
/* Os ícones são SVG em vez de emojis. Isso mantém o visual consistente em
   diferentes sistemas operativos, navegadores e dispositivos. */
function Icon({ d, size = 18 }: { d: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={d} />
    </svg>
  );
}

/* ========================================================================== */
/* ÍCONE DA NAVEGAÇÃO                                                         */
/* ========================================================================== */
/* Centralizamos os desenhos dos ícones para evitar repetição de SVG no JSX. */
function NavIcon({ page, avatar }: { page: Page; avatar?: string }) {
  const paths: Record<string, string> = {
    home: "M3 10.5 12 3l9 7.5M5 9v11h14V9M9 20v-6h6v6",
    categories:
      "M4 5h6v6H4zM14 5h6v6h-6zM4 15h6v6H4zM14 15h6v6h-6z",
    search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4",
    wishlist:
      "M20.8 8.8c0 5.5-8.8 10.2-8.8 10.2S3.2 14.3 3.2 8.8A4.8 4.8 0 0 1 12 6.2a4.8 4.8 0 0 1 8.8 2.6z",
    account:
      "M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
    cart:
      "M3 4h2l2.4 10.2a1 1 0 0 0 1 .8h8.8a1 1 0 0 0 1-.8L20 8H6M9 20h.01M17 20h.01",
  };

  // Com sessão iniciada, o ícone de perfil mostra as iniciais do utilizador em vez do boneco.
  if (page === "account" && avatar) return <span className="nav-avatar" aria-hidden="true">{avatar}</span>;
  return <Icon d={paths[page]} size={page === "account" ? 21 : 18} />;
}

/* ========================================================================== */
/* CONSENTIMENTO DE COOKIES                                                   */
/* ========================================================================== */
const COOKIE_KEY = "nhongaexpress:cookie-consent";

type CookiePreferences = {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
};

function CookieConsent() {
  const [prefs, setPrefs] = useState<CookiePreferences | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draft, setDraft] = useState<CookiePreferences>({ necessary: true, analytics: false, marketing: false });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(COOKIE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Partial<CookiePreferences>;
        const value: CookiePreferences = {
          necessary: true,
          analytics: saved.analytics === true,
          marketing: saved.marketing === true,
        };
        setPrefs(value);
        setDraft(value);
      }
    } catch { /* navegador sem armazenamento disponível */ }

    const openSettings = () => setSettingsOpen(true);
    window.addEventListener("nx:open-cookie-settings", openSettings);
    return () => window.removeEventListener("nx:open-cookie-settings", openSettings);
  }, []);

  const save = (value: CookiePreferences) => {
    try { localStorage.setItem(COOKIE_KEY, JSON.stringify(value)); } catch { /* ignora */ }
    setPrefs(value);
    setDraft(value);
    setSettingsOpen(false);
  };

  const openSettings = () => {
    setDraft(prefs ?? { necessary: true, analytics: false, marketing: false });
    setSettingsOpen(true);
  };

  if (prefs && !settingsOpen) return null;

  return (
    <>
      {!prefs && (
        <section className="cookie-banner" role="dialog" aria-label="Utilização de cookies" aria-describedby="cookie-description">
          <div className="cookie-banner-content">
            <div className="cookie-icon" aria-hidden="true">
              <Icon d="M12 3a9 9 0 1 0 9 9c0-.6-.06-1.18-.17-1.75A6.25 6.25 0 0 1 12.75 4.1 6.3 6.3 0 0 1 12 3Z M8 9h.01M9 15h.01M15 12h.01M13 18h.01" size={23} />
            </div>
            <div className="cookie-copy">
              <strong>Utilização de cookies</strong>
              <p id="cookie-description">
                Utilizamos cookies necessários para o funcionamento da plataforma e, com a sua autorização,
                cookies opcionais para melhorar a experiência. Pode alterar as suas preferências a qualquer momento.
              </p>
              <button type="button" className="cookie-link" onClick={openSettings}>Ver preferências</button>
            </div>
            <div className="cookie-actions">
              <button type="button" className="cookie-btn cookie-secondary" onClick={() => save({ necessary: true, analytics: false, marketing: false })}>
                Recusar opcionais
              </button>
              <button type="button" className="cookie-btn cookie-primary" onClick={() => save({ necessary: true, analytics: true, marketing: true })}>
                Aceitar todos
              </button>
            </div>
          </div>
        </section>
      )}

      {settingsOpen && (
        <div className="cookie-backdrop" role="presentation" onMouseDown={(e) => { if (e.currentTarget === e.target) setSettingsOpen(false); }}>
          <section className="cookie-modal" role="dialog" aria-modal="true" aria-labelledby="cookie-settings-title">
            <div className="cookie-modal-head">
              <div>
                <span className="cookie-eyebrow">Privacidade</span>
                <h2 id="cookie-settings-title">Preferências de cookies</h2>
              </div>
              <button type="button" className="cookie-close" aria-label="Fechar preferências" onClick={() => setSettingsOpen(false)}>×</button>
            </div>
            <p className="cookie-modal-intro">
              Escolha que tipos de cookies opcionais pretende permitir. Os cookies necessários permanecem ativos
              porque são essenciais para segurança, sessão e funcionamento básico do site.
            </p>

            <div className="cookie-options">
              <div className="cookie-option">
                <div><strong>Necessários</strong><small>Login, segurança, carrinho e funcionamento essencial.</small></div>
                <span className="cookie-always">Sempre ativos</span>
              </div>
              <label className="cookie-option cookie-toggle-row">
                <div><strong>Analíticos</strong><small>Ajudam a compreender como a plataforma é utilizada e a melhorar a experiência.</small></div>
                <input
                  type="checkbox"
                  checked={draft.analytics}
                  onChange={(e) => setDraft((v) => ({ ...v, analytics: e.target.checked }))}
                />
                <span className="cookie-switch" aria-hidden="true" />
              </label>
              <label className="cookie-option cookie-toggle-row">
                <div><strong>Marketing</strong><small>Podem ser usados para personalizar comunicações e conteúdos promocionais.</small></div>
                <input
                  type="checkbox"
                  checked={draft.marketing}
                  onChange={(e) => setDraft((v) => ({ ...v, marketing: e.target.checked }))}
                />
                <span className="cookie-switch" aria-hidden="true" />
              </label>
            </div>

            <div className="cookie-modal-actions">
              <button type="button" className="cookie-btn cookie-secondary" onClick={() => save({ necessary: true, analytics: false, marketing: false })}>
                Recusar opcionais
              </button>
              <button type="button" className="cookie-btn cookie-primary" onClick={() => save(draft)}>
                Guardar preferências
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

function openCookieSettings() {
  window.dispatchEvent(new CustomEvent("nx:open-cookie-settings"));
}

/* ========================================================================== */
/* COMPONENTE PRINCIPAL                                                       */
/* ========================================================================== */
function StoreApp() {
  /* ------------------------------------------------------------------------ */
  /* Estado principal do frontend                                              */
  /* ------------------------------------------------------------------------ */
  /* Estes estados continuam locais nesta etapa. Posteriormente serão
     substituídos ou sincronizados com o backend e a base de dados. */
  // "Router" simples: em vez de uma biblioteca de rotas, guardamos em estado qual página
  // está ativa. `go("cart")` troca de página. Começa na página inicial ("home");
  // o ecrã de login ("auth") só abre quando o utilizador clica em "Entrar" ou em "Conta".
  // O estado inicial vem do endereço, para a atualização da página (F5) manter o utilizador onde estava.
  const [route0] = useState(readRoute);
  const [page, setPage] = useState<Page>(route0.page);
  const [homeJump, setHomeJump] = useState<{ key: string; n: number }>({ key: route0.page === "home" ? route0.arg : "", n: route0.page === "home" && route0.arg ? 1 : 0 });
  // Navegar para qualquer página limpa a vitrine pedida (só o rodapé a define, via goShelf).
  const go = (p: Page) => {
    setHomeJump((j) => (j.key ? { key: "", n: j.n } : j));
    setPage(p);
    // Evita abrir a nova secção a meio da página após tocar na navbar.
    window.scrollTo({ top: 0, behavior: "auto" });
  };
  // false até o servidor dizer se há sessão; evita mostrar Conta/Checkout por instantes a quem não tem sessão.
  const [authChecked, setAuthChecked] = useState(false);
  // false até o catálogo chegar; evita "Produto não encontrado" ao atualizar a página de um produto.
  const [catalogReady, setCatalogReady] = useState(false);
  // true = utilizador autenticado. Ao abrir a app perguntamos ao backend se já há sessão (cookie).
  const [user, setUser] = useState(false);
  // Dados da conta (nome, e-mail, telefone...) devolvidos pelo servidor; alimentam o ícone e a página de perfil.
  const [profile, setProfile] = useState<ApiUser | null>(null);
  const [welcomeVisible, setWelcomeVisible] = useState(false);
  useEffect(() => {
    const onShowWelcome = () => setWelcomeVisible(true);
    window.addEventListener("nx:show-welcome", onShowWelcome);
    return () => window.removeEventListener("nx:show-welcome", onShowWelcome);
  }, []);
  // O cartão de boas-vindas fecha-se sozinho ao fim de 8 s.
  useEffect(() => {
    if (!welcomeVisible) return;
    const timer = window.setTimeout(() => setWelcomeVisible(false), 8000);
    return () => window.clearTimeout(timer);
  }, [welcomeVisible]);
  useEffect(() => {
    api.me().then((r) => {
      setProfile(r.user);
      setUser(true);
      // Veio de /admin (?next=admin) e já tem sessão: administradores seguem para o painel.
      if (wantsAdmin()) {
        if (r.user.role === "admin") { window.location.replace(ADMIN_BASE); return; }
        setToast("Esta conta não tem acesso ao painel administrativo."); setToastKey((k) => k + 1);
        clearNextParam();
      }
    }).catch(() => {
      // Veio de /admin sem sessão: mostra o login normal da loja.
      if (wantsAdmin()) go("auth");
    }).finally(() => setAuthChecked(true));
  }, []);
  useEffect(() => {
    api.products().then(({ products: rows }) => {
      setProducts(rows.map(toStoreProduct));
      // Remove do carrinho guardado produtos que já não existem no catálogo e atualiza o ecrã.
      const valid = new Set(rows.map((r) => r.id));
      if (rows.length) setCart((c) => {
        const kept = Object.fromEntries(Object.entries(c).filter(([id]) => valid.has(id)));
        return Object.keys(kept).length === Object.keys(c).length ? c : kept;
      });
      setCatalogTick((t) => t + 1);
    }).catch(() => {}).finally(() => setCatalogReady(true));
  }, []);
  // Categorias e ícones geridos no painel. Sem resposta (ou sem categorias), a loja mantém a lista fixa.
  useEffect(() => {
    fetch(`${API_BASE}/api/categories`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("categories"))))
      .then((d: { categories?: { name: string; icon: string }[] }) => {
        if (!d.categories?.length) return;
        applyApiCategories(d.categories);
        setCatalogTick((t) => t + 1);
      })
      .catch(() => {});
  }, []);
  // Carrinho como objeto { idDoProduto: quantidade }. Ex.: { 3: 2 } = 2 unidades do produto 3.
  const [cart, setCart] = useState<Record<string, number>>(loadCart);
  // Grava o carrinho sempre que muda (adicionar, remover, esvaziar após a compra).
  useEffect(() => { saveCart(cart); }, [cart]);
  // Sincroniza entre separadores: se o carrinho mudar noutro separador, este atualiza também.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => { if (e.key === CART_KEY) setCart(loadCart()); };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  // Incrementa quando o catálogo chega da API, para o carrinho guardado voltar a desenhar-se com nome, preço e imagem.
  const [, setCatalogTick] = useState(0);
  // Lista de desejos: apenas os ids dos produtos favoritos.
  const [wish, setWish] = useState<string[]>(loadWish);
  const [wishPulse, setWishPulse] = useState(0);
  const [cartPulse, setCartPulse] = useState(0);
  useEffect(() => { saveWish(wish); }, [wish]);

  // Pequenas animações de confirmação quando um item entra ou sai das listas.
  const previousWishLength = useRef(wish.length);
  const previousCartCount = useRef(0);
  useEffect(() => {
    if (wish.length !== previousWishLength.current) {
      previousWishLength.current = wish.length;
      setWishPulse((value) => value + 1);
    }
  }, [wish.length]);

  useEffect(() => {
    const nextCount = Object.values(cart).reduce((total, quantity) => total + quantity, 0);
    if (nextCount !== previousCartCount.current) {
      previousCartCount.current = nextCount;
      setCartPulse((value) => value + 1);
    }
  }, [cart]);
  useEffect(() => {
    const onStorage = (e: StorageEvent) => { if (e.key === WISH_KEY) setWish(loadWish()); };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  const [info, setInfo] = useState(route0.page === "info" && route0.arg ? route0.arg : "Sobre nós");
  const [q, setQ] = useState(route0.page === "search" ? route0.arg : "");
  const [open, setOpen] = useState(false);
  const [mobileCategoryFilterOpen, setMobileCategoryFilterOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  // O menu fica montado durante a animação de saída (.is-closing) e só depois é removido.
  const [menuMounted, setMenuMounted] = useState(false);
  useEffect(() => {
    if (mobileMenuOpen) { setMenuMounted(true); return; }
    const timer = window.setTimeout(() => setMenuMounted(false), 280);
    return () => window.clearTimeout(timer);
  }, [mobileMenuOpen]);
  // Sino de notificações: só abre com sessão iniciada. A posição do painel é calculada a partir do botão
  // clicado (há dois sinos: o da navegação no computador e o do cabeçalho no telemóvel; ambos têm data-bell).
  const [bellOpen, setBellOpen] = useState(false);
  const [bellPos, setBellPos] = useState({ top: 0, right: 8 });
  const bellPanelRef = useRef<HTMLDivElement>(null);
  // Pedidos do cliente (alimentam a página Pedidos e as notificações do sino).
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  // Moradas guardadas e preferências da conta (carregadas ao iniciar sessão).
  const [addresses, setAddresses] = useState<ApiAddress[]>([]);
  const [settings, setSettings] = useState<ApiSettings>(DEFAULT_SETTINGS);
  const [accountLoaded, setAccountLoaded] = useState(false);
  // Cópia sempre atual da preferência "avisos de pedidos" (usada dentro de funções assíncronas).
  const notifyRef = useRef(true);
  notifyRef.current = settings.notifyOrders;
  // Cópia sempre atual dos pedidos, para detetar mudanças de estado entre duas leituras do servidor.
  const ordersRef = useRef<ApiOrder[]>([]);
  useEffect(() => { ordersRef.current = orders; }, [orders]);
  // Notificações já lidas (chaves "idDoPedido:estado"). Ficam por ler até o cliente as abrir ou usar "Marcar todas como lidas".
  const [seen, setSeen] = useState<string[]>([]);
  // Secção da conta a abrir (Moradas, Métodos de pagamento...). Volta ao perfil quando se sai da conta.
  const [accountTarget, setAccountTarget] = useState<{ sec: string; orderId?: string; focus?: string }>({ sec: route0.page === "account" && Object.keys(sections).includes(route0.arg) ? route0.arg : "Informações do perfil" });
  // Mensagem de feedback temporária ("Produto adicionado...").
  // `toastKey` muda a cada mensagem para reiniciar o temporizador e a animação.
  const [toast, setToast] = useState<string | null>(null);
  const [toastKey, setToastKey] = useState(0);

  /* Guarda o produto selecionado para a página de detalhe. */
  const [selectedProductId, setSelectedProductId] = useState<string | null>(route0.page === "product" && route0.arg ? route0.arg : null);

  /* ------------------------------------------------------------------------ */
  /* Estado compartilhado entre as páginas                                    */
  /* ------------------------------------------------------------------------ */
  /* O objeto Store concentra as ações utilizadas pelas diferentes páginas. */
  const s: Store = {
    cart,
    wish,
    user,
    profile,
    setProfile,
    go,
    goShelf: (key) => { setHomeJump((j) => ({ key, n: j.n + 1 })); setPage("home"); },
    homeJump,
    setAccountSec: (sec) => setAccountTarget({ sec }),
    setUser,
    q,
    setQ,
    info,
    setInfo,
    selectedProductId,
    showToast: (message) => { setToast(message); setToastKey((k) => k + 1); },

    accountTarget,
    openAccount: (sec, orderId, focus) => { setAccountTarget({ sec, orderId, focus }); go("account"); },

    addresses, setAddresses,
    settings, setSettings,
    accountLoaded,
    welcomeVisible,
    dismissWelcome: () => setWelcomeVisible(false),


    orders,
    refreshOrders,
    // Pedido novo: entra no topo e gera uma notificação por ler no sino.
    addOrder: (order) => setOrders((current) => [order, ...current.filter((o) => o.id !== order.id)]),
    // Pedido alterado pelo próprio cliente (cancelar): atualiza no mesmo sítio e não gera notificação por ler.
    removeOrder: (id) => setOrders((current) => current.filter((o) => o.id !== id)),
    updateOrder: (order) => { setOrders((current) => current.map((o) => (o.id === order.id ? order : o))); markRead([notifKey(order)]); },

    /* Abre a página de detalhe do produto selecionado. */
    openProduct: (id) => {
      setSelectedProductId(id);
      go("product");
    },

    /* Adiciona ou remove unidades de um produto no carrinho. */
    add: (id, d = 1) =>
      setCart((currentCart) => {
        const quantity = (currentCart[id] || 0) + d;
        // Copia o carrinho sem a chave `id` (imutabilidade: nunca alteramos o estado diretamente).
        const { [id]: removed, ...rest } = currentCart;

        return quantity > 0 ? { ...rest, [id]: quantity } : rest;
      }),

    /* Esvazia o carrinho de uma vez (a gravação em localStorage é feita pelo useEffect do carrinho). */
    clearCart: () => setCart({}),

    /* Alterna o estado de favorito de um produto. */
    toggle: (id) =>
      setWish((currentWish) =>
        currentWish.includes(id)
          ? currentWish.filter((item) => item !== id)
          : [...currentWish, id]
      ),
  };

  /* ------------------------------------------------------------------------ */
  /* Contador do carrinho                                                      */
  /* ------------------------------------------------------------------------ */
  /* Soma todas as quantidades para apresentar um contador no ícone do carrinho. */
  // Total de unidades no carrinho (usado no badge do ícone).
  const count = Object.values(cart).reduce(
    (total, quantity) => total + quantity,
    0
  );

  // Esconde o toast após 2,4 s. A função devolvida limpa o temporizador
  // para evitar fugas de memória se o componente mudar antes.
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(null), 2400); return () => window.clearTimeout(timer); }, [toastKey]);

  useEffect(() => {
    // Com o menu móvel aberto, a tecla Esc fecha-o (acessibilidade por teclado).
    // O listener é removido na limpeza do efeito.
    if (!mobileMenuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileMenuOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [mobileMenuOpen]);

  // Ao terminar sessão o painel do sino fecha-se.
  useEffect(() => { if (!user) setBellOpen(false); }, [user]);

  // Ao sair da área de conta, a próxima visita começa de novo no perfil.
  useEffect(() => { if (page !== "account") setAccountTarget({ sec: "Informações do perfil" }); }, [page]);

  useEffect(() => {
    // Com o painel do sino aberto: clique fora, tecla Esc ou redimensionar fecham-no.
    if (!bellOpen) return;
    const onDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Element;
      if (bellPanelRef.current?.contains(target) || target.closest?.("[data-bell]")) return;
      setBellOpen(false);
    };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setBellOpen(false); };
    const onResize = () => setBellOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  }, [bellOpen]);

  /* ------------------------------------------------------------------------ */
  /* Pedidos e notificações                                                    */
  /* ------------------------------------------------------------------------ */
  // Chave do armazenamento local das notificações vistas (uma por conta).
  const seenKey = `nx_seen_notifs:${profile?.id ?? "anon"}`;

  /* Pede os pedidos ao servidor. Na primeira vez numa conta, marca os pedidos antigos como já vistos
     (só os pedidos NOVOS e as mudanças de estado seguintes contam como notificação). */
  async function refreshOrders() {
    try {
      const { orders: rows } = await api.myOrders();
      // Se o estado de um pedido mudou desde a última leitura (ex.: o administrador marcou "a caminho"), avisa com um toast.
      const before = new Map(ordersRef.current.map((o) => [o.id, o.status]));
      for (const o of rows) { const prev = before.get(o.id); if (prev && prev !== o.status && notifyRef.current) s.showToast(statusInfo(o.status).notice); }
      setOrders(rows);
      if (loadSeen(seenKey) === null) {
        const keys = rows.map(notifKey);
        setSeen(keys); saveSeen(seenKey, keys);
      }
    } catch { /* falha de rede ou sessão terminada: mantém o que já está no ecrã */ }
  }

  // Com sessão: carrega os pedidos e volta a carregá-los de 20 em 20 s (separador visível) e ao voltar ao separador.
  // É assim que o cliente vê "A caminho" / "Entregue" quando o administrador muda o estado.
  useEffect(() => {
    if (!user) { setOrders([]); setSeen([]); return; }
    setSeen(loadSeen(seenKey) ?? []);
    refreshOrders();
    const timer = window.setInterval(() => { if (!document.hidden) refreshOrders(); }, 20000);
    const onFocus = () => { refreshOrders(); };
    window.addEventListener("focus", onFocus);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", onFocus); };
  }, [user, profile?.id]);

  // Com sessão: carrega as moradas e as preferências da conta; sem sessão limpa tudo.
  useEffect(() => {
    if (!user) { setAddresses([]); setSettings(DEFAULT_SETTINGS); setAccountLoaded(false); return; }
    let alive = true;
    Promise.allSettled([api.addresses(), api.settings()]).then(([a, st]) => {
      if (!alive) return;
      if (a.status === "fulfilled") setAddresses(a.value.addresses);
      if (st.status === "fulfilled") setSettings(st.value.settings);
      setAccountLoaded(true);
    });
    return () => { alive = false; };
  }, [user, profile?.id]);

  // Uma notificação por pedido (os 15 mais recentes), com a frase do estado atual; as por ler vêm primeiro.
  // Se o cliente desligou os avisos de pedidos (Definições), o sino não mostra nem conta nada.
  const notifications = (settings.notifyOrders ? orders : [])
    .slice(0, 15)
    .map((order) => ({ key: notifKey(order), order, ...statusInfo(order.status) }))
    .sort((a, b) => Number(!seen.includes(b.key)) - Number(!seen.includes(a.key)));
  // Quantas ainda não foram lidas (número vermelho no sino).
  const unreadCount = notifications.filter((n) => !seen.includes(n.key)).length;
  /* Marca notificações como lidas (e guarda no navegador). */
  function markRead(keys: string[]) {
    const merged = [...seen, ...keys.filter((k) => !seen.includes(k))];
    setSeen(merged); saveSeen(seenKey, merged);
  }

  /* Clique no sino: sem sessão leva ao login; com sessão abre/fecha o painel. */
  const toggleBell = (event: ReactMouseEvent<HTMLButtonElement>) => {
    if (!user) {
      s.showToast("Inicie sessão para ver as suas notificações.");
      go("auth");
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    setBellPos({ top: rect.bottom + 8, right: Math.max(8, window.innerWidth - rect.right) });
    if (!bellOpen) refreshOrders(); // ao abrir, vai buscar o estado mais recente
    setBellOpen((value) => !value);
  };

  /* ------------------------------------------------------------------------ */
  /* Seleção da página atual                                                   */
  /* ------------------------------------------------------------------------ */
  /* ------------------------------------------------------------------------ */
  /* Endereço <-> página: a atualização (F5) e os botões Voltar/Avançar mantêm o sítio */
  /* ------------------------------------------------------------------------ */
  const routeArg =
    page === "home" ? homeJump.key
    : page === "info" ? info
    : page === "product" ? (selectedProductId ?? "")
    : page === "account" ? accountTarget.sec
    : page === "search" ? q
    : "";
  const lastPage = useRef(page);
  useEffect(() => {
    const cur = readRoute();
    if (!(cur.page === page && cur.arg === routeArg)) {
      // Escrever na pesquisa só substitui a entrada do histórico (não cria uma por letra).
      const replace = page === lastPage.current && page === "search";
      window.history[replace ? "replaceState" : "pushState"](null, "", buildHash(page, routeArg));
    }
    lastPage.current = page;
  }, [page, routeArg]);
  useEffect(() => {
    const onNav = () => {
      const r = readRoute();
      setPage(r.page);
      if (r.page === "info") setInfo(r.arg || "Sobre nós");
      if (r.page === "product") setSelectedProductId(r.arg || null);
      if (r.page === "account") setAccountTarget({ sec: Object.keys(sections).includes(r.arg) ? r.arg : "Informações do perfil" });
      if (r.page === "search") setQ(r.arg);
      setHomeJump((j) => ({ key: r.page === "home" ? r.arg : "", n: j.n + 1 }));
      setMobileMenuOpen(false);
      if (!(r.page === "home" && r.arg)) window.scrollTo({ top: 0 });
    };
    window.addEventListener("popstate", onNav);
    window.addEventListener("hashchange", onNav);
    return () => { window.removeEventListener("popstate", onNav); window.removeEventListener("hashchange", onNav); };
  }, []);
  // Conta e checkout exigem sessão: sem ela (depois de confirmado pelo servidor) vai para o login.
  useEffect(() => {
    if (authChecked && !user && (page === "account" || page === "checkout")) setPage("auth");
  }, [authChecked, user, page]);
  // Sem sessão (terminou ou expirou): apaga os rascunhos guardados para não aparecerem a outra pessoa.
  useEffect(() => { if (authChecked && !user) clearUiDrafts(); }, [authChecked, user]);
  // Ao atualizar a página, volta também à posição de scroll em que o utilizador estava.
  useEffect(() => {
    try { window.history.scrollRestoration = "manual"; } catch { /* ignora */ }
    const KEY = "nx:scroll";
    const save = () => { try { sessionStorage.setItem(KEY, JSON.stringify({ h: window.location.hash, y: window.scrollY })); } catch { /* ignora */ } };
    window.addEventListener("pagehide", save);
    let timer = 0;
    try {
      const sv = JSON.parse(sessionStorage.getItem(KEY) || "null") as { h: string; y: number } | null;
      sessionStorage.removeItem(KEY);
      if (sv && sv.h === window.location.hash && sv.y > 0 && !(route0.page === "home" && route0.arg)) {
        let tries = 0;
        timer = window.setInterval(() => {
          // Espera o conteúdo (catálogo, imagens) ter altura suficiente antes de descer.
          if (document.documentElement.scrollHeight >= sv.y + window.innerHeight || ++tries > 30) { window.scrollTo(0, sv.y); window.clearInterval(timer); }
        }, 100);
      }
    } catch { /* ignora */ }
    return () => { window.removeEventListener("pagehide", save); window.clearInterval(timer); };
  }, []);

  /* Cada valor de Page aponta para o componente correspondente. */
  const view = {
    auth: Auth,
    home: Home,
    categories: Categories,
    search: Search,
    wishlist: Wishlist,
    account: Account,
    cart: Cart,
    checkout: Checkout,
    info: Info,
    about: About,
    product: ProductDetail,
  }[page];

  // Em JSX, componentes dinâmicos têm de começar por maiúscula; por isso o alias `View`.
  // Enquanto o servidor não responde (sessão / catálogo), as páginas que dependem disso não desenham nada em vez de piscarem erros.
  const View = (!authChecked && (page === "account" || page === "checkout")) || (!catalogReady && page === "product") ? Blank : view;

  /* ------------------------------------------------------------------------ */
  /* Preparação das sugestões de pesquisa                                     */
  /* ------------------------------------------------------------------------ */
  /* A pesquisa utiliza os produtos e categorias existentes no frontend. */
  /* Faixa de categorias: setas de deslizar (visíveis só no computador, via CSS). Cada seta só aparece
     quando há mais cards para esse lado. */
  const catsRef = useRef<HTMLElement | null>(null);
  const [catsEdge, setCatsEdge] = useState({ start: true, end: true });
  const updateCats = () => {
    const el = catsRef.current;
    if (!el) return;
    setCatsEdge({ start: el.scrollLeft <= 2, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 2 });
  };
  const slideCats = (dir: 1 | -1) => catsRef.current?.scrollBy({ left: dir * catsRef.current.clientWidth, behavior: "smooth" });
  useEffect(() => {
    updateCats();
    window.addEventListener("resize", updateCats);
    return () => window.removeEventListener("resize", updateCats);
  }, [page]);

  const avatar = user && profile ? initials(profile.name) : undefined;
  const term = q.trim().toLowerCase();

  const cats = Object.entries(categories).flatMap(([group, subcategories]) => [
    group,
    ...subcategories,
  ]);

  const suggestions = term
    ? [
        ...new Set([
          ...cats.filter((item) => item.toLowerCase().includes(term)),
          ...products
            .filter((product) => product.name.toLowerCase().includes(term))
            .map((product) => product.name),
        ]),
      ].slice(0, 8)
    : [];

  /* ------------------------------------------------------------------------ */
  /* Seleção de uma sugestão                                                   */
  /* ------------------------------------------------------------------------ */
  /* Fecha as sugestões e encaminha o utilizador para a página de pesquisa. */
  const pick = (value: string) => {
    setQ(value);
    setOpen(false);
    go("search");
  };

  /* ======================================================================== */
  /* INTERFACE                                                                 */
  /* ======================================================================== */
  return (
    <>
      {/* -------------------------------------------------------------------- */}
      {/* Cabeçalho                                                             */}
      {/* -------------------------------------------------------------------- */}
      <header className="site-header">
        {/* Identidade da loja. Clicar no logotipo volta à página inicial. */}
        <button
          type="button"
          className="logo"
          aria-label="Ir para a página inicial"
          title="Página inicial"
          onClick={() => go("home")}
        >
          <span className="brand-lockup" aria-hidden="true">
            <img src="/favicon.svg" alt="" className="brand-mark" />
            <span className="brand-word">Nhonga<span>Express</span></span>
          </span>
        </button>

        {/* ------------------------------------------------------------------ */}
        {/* Pesquisa                                                             */}
        {/* ------------------------------------------------------------------ */}
        <div className="mobile-search-row">
        <div className="hsearch">
          <input
            value={q}
            aria-label="Pesquisar produtos"
            placeholder="" // vazio de propósito: o texto animado <SearchHint /> ocupa este lugar
            onFocus={() => setOpen(true)}
            onBlur={() => setOpen(false)}
            onChange={(event) => {
              setQ(event.target.value);
              setOpen(true);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") pick(q);
            }}
          />

          {/* Sugestão animada com as categorias (desaparece ao escrever). */}
          {!q && <SearchHint items={Object.keys(categories)} />}

          {/* Botão de pesquisa com SVG, sem utilização de emoji. */}
          <button
            type="button"
            className="hsearch-btn"
            aria-label="Pesquisar"
            title="Pesquisar"
            onClick={() => pick(q)}
          >
            <Icon
              d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4"
              size={18}
            />
          </button>

          {/* Sugestões apresentadas durante a pesquisa. Usamos onMouseDown em vez de onClick
              porque o onBlur do input fecharia a lista antes de o clique ser registado. */}
          {open && suggestions.length > 0 && (
            <ul className="search-suggestions">
              {suggestions.map((item) => (
                <li key={item} onMouseDown={() => pick(item)}>
                  {item}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="mobile-category-filter-wrap">
          <button
            type="button"
            className={`mobile-category-filter${mobileCategoryFilterOpen ? " is-open" : ""}`}
            aria-label="Filtrar por categoria"
            aria-expanded={mobileCategoryFilterOpen}
            title="Filtrar por categoria"
            onClick={() => setMobileCategoryFilterOpen((value) => !value)}
          >
            <Icon d="M4 6h16M7 12h10M10 18h4" size={20} />
          </button>
          {mobileCategoryFilterOpen && (
            <div className="mobile-category-filter-menu" role="menu" aria-label="Escolher categoria">
              <button type="button" role="menuitem" onClick={() => { setMobileCategoryFilterOpen(false); setQ(""); go("categories"); }}>Todas as categorias</button>
              {Object.keys(categories).map((category) => (
                <button type="button" role="menuitem" key={category} onClick={() => { setMobileCategoryFilterOpen(false); pick(category); }}>{category}</button>
              ))}
            </div>
          )}
        </div>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* Navegação por ícones                                                 */}
        {/* ------------------------------------------------------------------ */}
        <nav aria-label="Navegação principal">
          {nav.map((item) => {
            // Sino de notificações.
            if (item === "bell") {
              return (
                <button
                  key="bell"
                  data-bell
                  type="button"
                  className={`ico-only ${bellOpen ? "on" : ""}`}
                  aria-label="Notificações"
                  title="Notificações"
                  aria-haspopup="menu"
                  aria-expanded={user ? bellOpen : undefined}
                  onClick={toggleBell}
                >
                  <Icon d={BELL_PATH} size={19} />
                  {/* Número de notificações novas (só com sessão iniciada). */}
                  {user && unreadCount > 0 && <span className="bell-badge" aria-label={`${unreadCount} notificações novas`}>{unreadCount > 9 ? "9+" : unreadCount}</span>}
                </button>
              );
            }

            return (
              <button
                key={item}
                type="button"
                className={`ico-only ${page === item ? "on" : ""} ${item === "wishlist" && wishPulse ? "has-pulse" : ""} ${item === "cart" && cartPulse ? "has-pulse" : ""}`}
                aria-label={navLabels[item]}
                title={navLabels[item]}
                onClick={() => go(item)}
              >
                <NavIcon page={item} avatar={avatar} />

                {item === "wishlist" && wish.length > 0 && (
                  <span key={`wish-badge-${wishPulse}`} className="wishlist-badge" aria-label={`${wish.length} produtos na lista de desejos`}>
                    {wish.length > 99 ? "99+" : wish.length}
                  </span>
                )}

                {/* Badge do carrinho. Só aparece quando existe pelo menos um item. */}
                {item === "cart" && count > 0 && (
                  <span key={`cart-badge-${cartPulse}`} className="cart-badge" aria-label={`${count} itens`}>
                    {count > 99 ? "99+" : count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Opção "Sobre nós" em formato de ícone (informação). Fica logo à direita do ícone do carrinho. Visível apenas no desktop;
            no telemóvel esta ação está no menu lateral. O nome fica em aria-label/title. */}
        <button
          type="button"
          className={`header-about-link ${page === "about" ? "on" : ""}`}
          aria-label="Sobre nós"
          title="Sobre nós"
          aria-current={page === "about" ? "page" : undefined}
          onClick={() => go("about")}
        >
          <Icon d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 16v-4M12 8h.01" size={20} />
        </button>

        {/* ------------------------------------------------------------------ */}
        {/* Entrar / Conta                                                       */}
        {/* ------------------------------------------------------------------ */}
        {/* O botão Entrar concentra agora a lógica que antes pertencia ao ícone de perfil:
            sem sessão abre o login; com sessão abre a conta. */}
        <button
          type="button"
          className={`header-login-btn ${user ? "is-logged" : ""} ${page === "account" ? "on" : ""}`}
          aria-label={user ? `Abrir conta de ${profile?.name ?? "utilizador"}` : "Entrar"}
          title={user ? "Minha conta" : "Entrar"}
          onClick={() => go(user ? "account" : "auth")}
        >
          {user ? <NavIcon page="account" avatar={avatar} /> : "Entrar"}
        </button>

        {/* Sino de notificações do telemóvel (escondido no computador, onde o sino está na navegação).
            Fica à direita do ícone de perfil, antes do hambúrguer. */}
        <button
          type="button"
          data-bell
          className={`header-bell-mobile ${bellOpen ? "on" : ""}`}
          aria-label="Notificações"
          title="Notificações"
          aria-haspopup="menu"
          aria-expanded={user ? bellOpen : undefined}
          onClick={toggleBell}
        >
          <Icon d={BELL_PATH} size={22} />
          {user && unreadCount > 0 && <span className="bell-badge" aria-label={`${unreadCount} notificações novas`}>{unreadCount > 9 ? "9+" : unreadCount}</span>}
        </button>

        <button
          type="button"
          className="mobile-menu-toggle"
          aria-label={mobileMenuOpen ? "Fechar menu" : "Abrir menu"}
          aria-expanded={mobileMenuOpen}
          title={mobileMenuOpen ? "Fechar menu" : "Abrir menu"}
          onClick={() => setMobileMenuOpen((value) => !value)}
        >
          <span />
          <span />
          <span />
        </button>
      </header>

      {/* Categorias em linha horizontal, logo abaixo da barra de pesquisa. Esta faixa é só do telemóvel (todas as
          páginas); no computador as categorias ficam abaixo do banner (HomeCatsStrip) e no filtro lateral (HomeCatsSide).
          Cada uma é um quadrado de cantos arredondados com ícone e nome. Usa o mesmo caminho das
          sugestões (`pick`): preenche a pesquisa com o grupo e abre a página Pesquisa. */}
      {page !== "auth" && (
        <div className="cats-bar no-desk">
          <button type="button" className={`cats-arrow cats-arrow-prev${catsEdge.start ? " is-off" : ""}`} aria-label="Categorias anteriores" onClick={() => slideCats(-1)}>
            <Icon d="M15 6l-6 6 6 6" size={20} />
          </button>
          <nav ref={catsRef} onScroll={updateCats} className="mobile-cats no-desk" aria-label="Categorias">
            {Object.keys(categories).map((group) => (
              <button
                key={group}
                type="button"
                className={page === "search" && q === group ? "on" : ""}
                onClick={() => pick(group)}
              >
                <span className="mcat-ico"><CatIcon name={group} /></span>
                <span className="mcat-name">{group}</span>
              </button>
            ))}
          </nav>
          <button type="button" className={`cats-arrow cats-arrow-next${catsEdge.end ? " is-off" : ""}`} aria-label="Mais categorias" onClick={() => slideCats(1)}>
            <Icon d="M9 6l6 6-6 6" size={20} />
          </button>
        </div>
      )}

      {/* Painel de notificações (fora do <header> para não ser cortado pelo scroll horizontal da navegação no telemóvel).
          Só mostra notificações dos pedidos; as opções da conta ficam na página Conta. */}
      {bellOpen && user && (
        <div
          ref={bellPanelRef}
          className="bell-menu nf-menu"
          role="dialog"
          aria-label="Notificações"
          style={{ "--bell-top": `${bellPos.top}px`, "--bell-right": `${bellPos.right}px` } as CSSProperties}
        >
          <div className="nf-head">
            <strong>Notificações{unreadCount > 0 && <span className="nf-count">{unreadCount}</span>}</strong>
            <button type="button" className="nf-readall" disabled={unreadCount === 0} onClick={() => markRead(notifications.map((n) => n.key))}>
              <Icon d={IC.checkAll} size={15} /> Marcar todas como lidas
            </button>
          </div>

          {notifications.length === 0 ? (
            <div className="nf-empty">
              <span className="nf-empty-ico"><Icon d={BELL_PATH} size={26} /></span>
              <strong>{settings.notifyOrders ? "Sem notificações" : "Avisos desativados"}</strong>
              <p>{settings.notifyOrders ? "Quando fizer um pedido, as atualizações da entrega aparecem aqui." : "Ative os avisos de pedidos nas definições para voltar a vê-los aqui."}</p>
              {!settings.notifyOrders && <button type="button" className="nf-readall" onClick={() => { setBellOpen(false); s.openAccount("Definições"); }}>Abrir definições</button>}
            </div>
          ) : (
            <ul className="nf-list">
              {notifications.map((n) => {
                const unread = !seen.includes(n.key);
                return (
                  <li key={n.key}>
                    <button
                      type="button"
                      className={`nf-item tone-${n.tone} ${unread ? "unread" : ""}`}
                      onClick={() => { markRead([n.key]); setBellOpen(false); s.openAccount("Pedidos", n.order.id); }}
                    >
                      <span className="nf-ico"><Icon d={TONE_ICON[n.tone]} size={18} /></span>
                      <span className="nf-body">
                        <strong>{n.title}</strong>
                        <span>{n.notice}</span>
                        <small>Pedido {shortId(n.order.id)} · feito {timeAgo(n.order.createdAt)}</small>
                      </span>
                      {unread && <i className="nf-dot" aria-label="Não lida" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {notifications.length > 0 && (
            <button type="button" className="nf-foot" onClick={() => { setBellOpen(false); s.openAccount("Pedidos"); }}>Ver todos os pedidos</button>
          )}
        </div>
      )}

      {/* Menu lateral (telemóvel). Clicar no fundo escuro fecha-o; o painel usa stopPropagation
         para que cliques dentro dele não o fechem. */}
      {menuMounted && (
        <div className={`mobile-menu-layer ${mobileMenuOpen ? "is-open" : "is-closing"}`} onMouseDown={() => setMobileMenuOpen(false)}>
          <aside
            className="mobile-menu-panel"
            aria-label="Menu principal"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="mobile-menu-head">
              <button
                type="button"
                className="mobile-menu-brand"
                onClick={() => { setMobileMenuOpen(false); go("home"); }}
                aria-label="Ir para a página inicial"
              >
                <img src="/favicon.svg" alt="" />
                <span>Nhonga<span>Express</span></span>
              </button>
              <button
                type="button"
                className="mobile-menu-close"
                aria-label="Fechar menu"
                onClick={() => setMobileMenuOpen(false)}
              >
                ×
              </button>
            </div>

            {/* Pesquisa: logo abaixo do logotipo. Enter ou o botão levam à página Pesquisar com o texto escrito. */}
            <form className="mobile-menu-search" role="search" onSubmit={(event) => { event.preventDefault(); setMobileMenuOpen(false); pick(q); }}>
              <Icon d={AI.search} size={18} />
              <input type="search" value={q} onChange={(event) => setQ(event.target.value)} placeholder="Pesquisar produtos" aria-label="Pesquisar produtos" enterKeyHint="search" autoComplete="off" maxLength={80} />
              {q && <button type="button" className="mobile-menu-search-clear" aria-label="Limpar pesquisa" onClick={() => setQ("")}>×</button>}
            </form>

            <div className="mobile-menu-links">
              {[
                ["account", user ? "Minha conta" : "Entrar"], // perfil é a primeira opção do menu
                ["home", "Início"],
                ["categories", "Categorias"],
                ["cart", "Carrinho"],
                ["wishlist", "Lista de desejos"],
              ].map(([item, label]) => {
                const mobilePage = item as Page;
                const target = mobilePage === "account" && !user ? "auth" : mobilePage;
                return (
                  <button
                    key={item}
                    type="button"
                    className={page === mobilePage ? "on" : ""}
                    onClick={() => { setMobileMenuOpen(false); go(target); }}
                  >
                    <span className="mobile-menu-link-icon"><NavIcon page={mobilePage} avatar={avatar} /></span>
                    <span>{label}</span>
                    {mobilePage === "cart" && count > 0 && <b className="mobile-count-badge">{count > 99 ? "99+" : count}</b>}
                    {mobilePage === "wishlist" && wish.length > 0 && <b className="mobile-count-badge">{wish.length > 99 ? "99+" : wish.length}</b>}
                  </button>
                );
              })}

              {/* Definições: logo a seguir à Lista de desejos. Sem sessão leva ao login. */}
              <button
                type="button"
                className={page === "account" && accountTarget?.sec === "Definições" ? "on" : ""}
                onClick={() => { setMobileMenuOpen(false); if (user) s.openAccount("Definições"); else go("auth"); }}
              >
                <span className="mobile-menu-link-icon"><Icon d={SETTINGS_PATH} size={20} /></span>
                <span>Definições</span>
              </button>

              {/* Terminar sessão: só aparece com sessão iniciada (no telemóvel o botão Sair do cabeçalho fica oculto). */}
              {user && (
                <button
                  type="button"
                  className="mobile-menu-logout"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    api.logout().catch(() => {}); // termina a sessão também no servidor
                    setUser(false);
                    setProfile(null);
                    go("home");
                  }}
                >
                  <span className="mobile-menu-link-icon">
                    <Icon d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" size={20} />
                  </span>
                  <span>Terminar sessão</span>
                </button>
              )}
            </div>

            <div className="mobile-menu-contact">
              <strong>Fale connosco</strong>
              <button type="button" onClick={() => { setMobileMenuOpen(false); if (company.whatsapp) window.open(`https://wa.me/${company.whatsapp}`, "_blank", "noopener,noreferrer"); else { s.setInfo("Contacto"); go("info"); } }}>
                <span className="mobile-menu-link-icon"><Icon d={AI.chat} size={20} /></span>
                <span className="mobile-menu-contact-text">Contacto e suporte{company.whatsapp ? <small>Atendimento por WhatsApp</small> : company.hours && <small>{company.hours}</small>}</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* Conteúdo da página                                                    */}
      {/* -------------------------------------------------------------------- */}
      <main>
        <View s={s} />
      </main>

      {/* -------------------------------------------------------------------- */}
      {/* Rodapé                                                               */}
      {/* -------------------------------------------------------------------- */}
      <Footer s={s} />

      {/* Navegação inferior exclusiva para telemóvel. Mantém as ações principais
          sempre acessíveis sem ocupar espaço no conteúdo principal. */}
      {page !== "auth" && (
        <nav className="mobile-bottom-nav" aria-label="Navegação móvel">
          {["home", "categories", "cart", "account"].map((item) => {
            const mobilePage = item as Page;
            const target = mobilePage === "account" && !user ? "auth" : mobilePage;
            return (
              <button
                key={mobilePage}
                type="button"
                className={`mobile-bottom-item ${page === mobilePage ? "on" : ""}`}
                aria-label={mobileLabels[mobilePage] ?? navLabels[mobilePage]}
                aria-current={page === mobilePage ? "page" : undefined}
                onClick={() => go(target)}
              >
                <span className="mobile-bottom-icon">
                  {/* Sem `avatar`: o ícone de conta da barra inferior é sempre o boneco.
                      O avatar com iniciais aparece só no cabeçalho. */}
                  <NavIcon page={mobilePage} />
                  {mobilePage === "cart" && count > 0 && (
                    <span className="mobile-cart-badge">{count}</span>
                  )}
                </span>
                <span>{mobileLabels[mobilePage] ?? navLabels[mobilePage]}</span>
              </button>
            );
          })}
        </nav>
      )}

      {/* Notificação temporária. role="status" + aria-live avisam leitores de ecrã. */}
      {toast && <div key={toastKey} className="toast" role="status" aria-live="polite">{toast}</div>}

      {/* Consentimento de cookies: aparece uma vez e pode ser reaberto pelo rodapé. */}
      <CookieConsent />
    </>
  );
}


export default StoreApp;
