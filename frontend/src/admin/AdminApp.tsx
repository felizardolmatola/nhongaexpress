/**
 * admin/AdminApp.tsx — painel administrativo da NhongaExpress.
 *
 * - Login: NÃO existe login aqui. O administrador entra pelo login normal da loja
 *   (a conta tem role = "admin"). Sem sessão, /admin envia para `/?next=admin`.
 * - Rotas: /admin, /admin/produtos, /admin/clientes, /admin/pedidos (ver SECTIONS).
 *   Usam o histórico do navegador, por isso o botão "voltar" e o F5 funcionam.
 * - Estilos: css/styles.css (secção do painel; todas as classes começam por `adm-`).
 *   O <body> leva a classe `is-admin`, que desliga os estilos globais da loja aqui.
 */
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  adminApi, AdminApiError, homeApi, HOME_SECTION_META, logoutAndLeave, optimizeProductImage, uploadProductImage, MAX_PRODUCT_PHOTOS, MAX_PRODUCT_SPECS,
  type Admin, type Category, type Driver, type HomeSection, type HomeSectionSlug, type Customer, type Dashboard, type Order, type OrderEvent, type Product, type ProductInput, type ProductSpec,
} from "./adminApi";
import { ADMIN_BASE, ADMIN_LOGIN_URL } from "../services/route";
import { categories } from "../services/data";
import { suggestIconKey } from "../services/categoryIcons";
import DeliverySettings from "./DeliverySettings";

/* ========================================================================== */
/* Ajudantes                                                                  */
/* ========================================================================== */
const money = (v: number) => `${Number(v || 0).toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\u00A0/g, ".").replace(/\s/g, "")} MT`;
const date = (v: string) => new Date(v).toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric" });
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase() || "A";
const errorText = (e: unknown) => (e instanceof Error ? e.message : "Ocorreu um erro. Tente novamente.");

/* Ícones de linha (mesmo estilo dos ícones da loja: traço de 2px, cantos redondos). */
const ICONS = {
  dashboard: "M4 5h6v6H4zM14 5h6v6h-6zM4 15h6v6H4zM14 15h6v6h-6z",
  categories: "M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8zM7 7h.01",
  home: "M12 3l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.8 6.2 20.9l1.1-6.5L2.6 9.8l6.5-.9z",
  products: "M21 8l-9-5-9 5v8l9 5 9-5V8zM3.3 7.5 12 12.5l8.7-5M12 22V12.5",
  customers: "M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M10 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM21 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8",
  orders: "M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2zM9 12h6M9 16h4",
  drivers: "M8 17.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM22 17.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM5 17.5l2.5-6H13l3 6M19 17.5 16.5 8H14M7.5 11.5H5M10 11.5l1.5 6", /* mota */
  delivery: "M12 22s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11zM12 11a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  revenue: "M2 7h20v10H2zM12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM6 11h.01M18 13h.01",
  store: "M3 10.5 12 3l9 7.5M5 9v11h14V9M9 20v-6h6v6",
  logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
  menu: "M3 6h18M3 12h18M3 18h18",
  plus: "M12 5v14M5 12h14",
  edit: "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z",
  trash: "M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6",
  close: "M18 6 6 18M6 6l12 12",
  upload: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12",
  left: "M15 18l-6-6 6-6",
  right: "M9 18l6-6-6-6",
} as const;
type IconName = keyof typeof ICONS;

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={ICONS[name]} />
    </svg>
  );
}

/** Logotipo igual ao da loja: quadrado vermelho (favicon.svg) + "Nhonga" a negrito + "Express" leve. */
function Brand({ caption }: { caption?: string }) {
  return (
    <div className="adm-brand">
      <img src="/favicon.svg" alt="" className="adm-brand-mark" />
      <div>
        <span className="adm-brand-word">Nhonga<span>Express</span></span>
        {caption && <small>{caption}</small>}
      </div>
    </div>
  );
}

/* ========================================================================== */
/* Rotas do painel                                                            */
/* ========================================================================== */
type View = "dashboard" | "products" | "categories" | "home" | "customers" | "orders" | "drivers" | "delivery";

const SECTIONS: Record<View, { slug: string; label: string; hint: string }> = {
  dashboard: { slug: "", label: "Dashboard", hint: "Resumo da atividade da loja" },
  products: { slug: "produtos", label: "Produtos", hint: "Catálogo, preços e stock" },
  categories: { slug: "categorias", label: "Categorias", hint: "Crie e edite as categorias e os seus ícones" },
  home: { slug: "pagina-inicial", label: "Página inicial", hint: "Produtos de cada secção da loja" },
  customers: { slug: "clientes", label: "Clientes", hint: "Contas registadas na loja" },
  orders: { slug: "pedidos", label: "Pedidos", hint: "Acompanhe as compras e as entregas" },
  drivers: { slug: "entregadores", label: "Entregadores", hint: "Equipa de entrega" },
  delivery: { slug: "configuracao-entrega", label: "Configuração de entrega", hint: "Ponto de partida GPS e tarifa por quilómetro" },
};
const VIEWS = Object.keys(SECTIONS) as View[];
const pathFor = (v: View) => (SECTIONS[v].slug ? `${ADMIN_BASE}/${SECTIONS[v].slug}` : ADMIN_BASE);

/** Lê a secção do endereço. Endereço desconhecido (/admin/xyz) → null. */
const viewFromPath = (): View | null => {
  const slug = window.location.pathname.slice(ADMIN_BASE.length).replace(/^\/+|\/+$/g, "");
  return VIEWS.find((v) => SECTIONS[v].slug === slug) ?? null;
};

function useAdminRoute() {
  const [view, setView] = useState<View>(() => {
    const v = viewFromPath();
    if (!v) window.history.replaceState(null, "", ADMIN_BASE); // /admin/xyz → /admin
    return v ?? "dashboard";
  });
  useEffect(() => {
    const onPop = () => setView(viewFromPath() ?? "dashboard");
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const navigate = useCallback((v: View) => {
    if (pathFor(v) !== window.location.pathname) window.history.pushState(null, "", pathFor(v));
    setView(v);
  }, []);
  return [view, navigate] as const;
}

/* ========================================================================== */
/* Componente raiz: verifica a sessão antes de mostrar o painel               */
/* ========================================================================== */
type Gate = { kind: "loading" } | { kind: "ready"; admin: Admin } | { kind: "denied" } | { kind: "error"; message: string };

export default function AdminApp() {
  const [gate, setGate] = useState<Gate>({ kind: "loading" });
  const check = useCallback(() => {
    setGate({ kind: "loading" });
    adminApi.me()
      .then(({ admin }) => setGate({ kind: "ready", admin }))
      .catch((e: unknown) => {
        const status = e instanceof AdminApiError ? e.status : 0;
        if (status === 401) return; // adminApi já está a redirecionar para o login da loja
        setGate(status === 403 ? { kind: "denied" } : { kind: "error", message: errorText(e) });
      });
  }, []);
  useEffect(check, [check]);

  if (gate.kind === "loading") return <GateScreen><div className="adm-spinner" role="status" aria-label="A carregar painel" /></GateScreen>;
  if (gate.kind === "denied") {
    return (
      <GateScreen>
        <Brand caption="Painel administrativo" />
        <h1>Acesso restrito</h1>
        <p>Esta conta não tem acesso ao painel administrativo.</p>
        <div className="adm-gate-actions">
          <button className="adm-btn" onClick={() => logoutAndLeave(ADMIN_LOGIN_URL)}>Entrar com outra conta</button>
          <a className="adm-btn ghost" href="/">Voltar à loja</a>
        </div>
      </GateScreen>
    );
  }
  if (gate.kind === "error") {
    return (
      <GateScreen>
        <Brand caption="Painel administrativo" />
        <h1>Não foi possível abrir o painel</h1>
        <p>{gate.message}</p>
        <div className="adm-gate-actions"><button className="adm-btn" onClick={check}>Tentar novamente</button></div>
      </GateScreen>
    );
  }
  return <Shell admin={gate.admin} />;
}

function GateScreen({ children }: { children: ReactNode }) {
  return <div className="adm adm-gate"><div className="adm-gate-card">{children}</div></div>;
}

/* ========================================================================== */
/* Estrutura: menu lateral + cabeçalho                                        */
/* ========================================================================== */
function Shell({ admin }: { admin: Admin }) {
  const [view, navigate] = useAdminRoute();
  const [menuOpen, setMenuOpen] = useState(false);
  const section = SECTIONS[view];

  return (
    <div className="adm adm-app">
      <aside className={`adm-sidebar ${menuOpen ? "open" : ""}`} aria-label="Menu do painel">
        <Brand caption="Painel administrativo" />
        <nav className="adm-nav">
          {VIEWS.map((v) => (
            <a
              key={v}
              href={pathFor(v)}
              className={view === v ? "on" : ""}
              aria-current={view === v ? "page" : undefined}
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return; // deixa abrir em novo separador
                e.preventDefault();
                navigate(v);
                setMenuOpen(false);
              }}
            >
              <Icon name={v} />
              {SECTIONS[v].label}
            </a>
          ))}
        </nav>
        <div className="adm-sidebar-foot">
          <a href="/" className="adm-nav-extra"><Icon name="store" />Ver a loja</a>
          <button className="adm-nav-extra" onClick={() => logoutAndLeave("/")}><Icon name="logout" />Terminar sessão</button>
        </div>
      </aside>
      {menuOpen && <div className="adm-overlay" onClick={() => setMenuOpen(false)} />}

      <div className="adm-main">
        <header className="adm-header">
          <button className="adm-menu-btn" onClick={() => setMenuOpen(!menuOpen)} aria-label="Abrir menu" aria-expanded={menuOpen}><Icon name="menu" size={22} /></button>
          <div className="adm-header-title">
            <strong>{section.label}</strong>
            <span>{section.hint}</span>
          </div>
          <div className="adm-user" title={admin.email ?? admin.phone ?? ""}>
            <span className="adm-avatar" aria-hidden="true">{initials(admin.name)}</span>
            <span className="adm-user-name">{admin.name}</span>
          </div>
        </header>
        <main className="adm-content">
          {view === "dashboard" ? <DashboardView goTo={navigate} /> : view === "products" ? <ProductsView /> : view === "categories" ? <CategoriesView /> : view === "home" ? <HomeSectionsView /> : view === "customers" ? <CustomersView /> : view === "drivers" ? <DriversView /> : view === "delivery" ? <DeliverySettings /> : view === "orders" ? <OrdersView /> : <OrdersView />}
        </main>
      </div>
    </div>
  );
}

/* ========================================================================== */
/* Peças reutilizáveis                                                        */
/* ========================================================================== */
const STATUS_LABELS: Record<string, string> = {
  active: "Ativo", inactive: "Inativo", pending: "Pendente", paid: "Pago", processing: "Em processamento",
  shipped: "Enviado", completed: "Concluído", cancelled: "Cancelado",
};

function Badge({ value }: { value: string }) {
  return <span className={`adm-badge ${value}`}>{STATUS_LABELS[value] ?? value}</span>;
}

function PageTitle({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return (
    <div className="adm-page-title">
      <div><h1>{title}</h1><p>{text}</p></div>
      {action}
    </div>
  );
}

function Notice({ children }: { children: ReactNode }) {
  return <div className="adm-notice" role="alert">{children}</div>;
}

function Loading({ text }: { text: string }) {
  return <div className="adm-loading" role="status"><div className="adm-spinner" />{text}</div>;
}

function Empty({ icon, text }: { icon: IconName; text: string }) {
  return <div className="adm-empty"><Icon name={icon} size={28} /><p>{text}</p></div>;
}

type Row = { key: string; cells: ReactNode[] };
function DataTable({ headers, rows }: { headers: string[]; rows: Row[] }) {
  return (
    <div className="adm-table-wrap">
      <table className="adm-table">
        <thead><tr>{headers.map((h) => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((r) => <tr key={r.key}>{r.cells.map((c, i) => <td key={i}>{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

/** Carrega dados de uma rota do admin e guarda o estado de "a carregar" e de erro. */
function useLoad<T>(fetcher: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(() => {
    setError("");
    return fetcher().then(setData).catch((e) => setError(errorText(e)));
  }, [fetcher]);
  useEffect(() => { void load(); }, [load]);
  return { data, setData, error, setError, reload: load };
}

/* ========================================================================== */
/* Dashboard                                                                  */
/* ========================================================================== */
const fetchDashboard = () => adminApi.dashboard();

function DashboardView({ goTo }: { goTo: (v: View) => void }) {
  const { data, error } = useLoad<Dashboard>(fetchDashboard);
  if (error) return <Notice>{error}</Notice>;
  if (!data) return <Loading text="A carregar dashboard…" />;

  const cards: { label: string; value: string | number; hint: string; icon: IconName; to: View }[] = [
    { label: "Clientes", value: data.stats.customers, hint: "Utilizadores registados", icon: "customers", to: "customers" },
    { label: "Produtos", value: data.stats.products, hint: "Produtos ativos", icon: "products", to: "products" },
    { label: "Pedidos", value: data.stats.orders, hint: "Pedidos encontrados", icon: "orders", to: "orders" },
    { label: "Receita", value: money(data.stats.revenue), hint: "Total dos pedidos", icon: "revenue", to: "orders" },
  ];

  return (
    <>
      <PageTitle title="Visão geral" text="Resumo da atividade da loja." />
      <div className="adm-stats">
        {cards.map((c) => (
          <button key={c.label} className="adm-stat" onClick={() => goTo(c.to)}>
            <span className="adm-stat-top"><span>{c.label}</span><span className="adm-icon-box"><Icon name={c.icon} size={20} /></span></span>
            <strong>{c.value}</strong>
            <small>{c.hint}</small>
          </button>
        ))}
      </div>
      <section className="adm-card">
        <div className="adm-card-head">
          <h2>Pedidos recentes</h2>
          {data.recentOrders.length > 0 && <button className="adm-link" onClick={() => goTo("orders")}>Ver todos</button>}
        </div>
        {data.recentOrders.length ? (
          <DataTable
            headers={["Pedido", "Cliente", "Total", "Estado", "Data"]}
            rows={data.recentOrders.map((o) => ({ key: o.id, cells: [`#${o.id.slice(0, 8)}`, o.customer, money(o.total), <Badge key="s" value={o.status} />, date(o.createdAt)] }))}
          />
        ) : <Empty icon="orders" text="Ainda não existem pedidos." />}
      </section>
    </>
  );
}

/* ========================================================================== */
/* Produtos                                                                   */
/* ========================================================================== */
const fetchProducts = () => adminApi.products().then((r) => r.products);
const NEW_PRODUCT: Product = { id: "", name: "", description: "", price: 3000, category: "", image: "", images: [], stock: 0, active: true, createdAt: "", updatedAt: "" };

function ProductsView() {
  const { data: items, error, setError, reload } = useLoad<Product[]>(fetchProducts);
  const [editing, setEditing] = useState<Product | null>(null);

  const remove = async (p: Product) => {
    if (!confirm(`Eliminar "${p.name}"? Esta ação não pode ser desfeita.`)) return;
    try { await adminApi.deleteProduct(p.id); await reload(); } catch (e) { setError(errorText(e)); }
  };

  return (
    <>
      <PageTitle title="Produtos" text="Crie, edite, ative e remova produtos."
        action={<button className="adm-btn" onClick={() => setEditing(NEW_PRODUCT)}><Icon name="plus" size={16} />Novo produto</button>} />
      {error && <Notice>{error}</Notice>}
      {!items ? (!error && <Loading text="A carregar produtos…" />) : (
        <section className="adm-card">
          {items.length ? (
            <DataTable
              headers={["Produto", "Categoria", "Preço", "Stock", "Estado", "Ações"]}
              rows={items.map((p) => ({
                key: p.id,
                cells: [
                  <div className="adm-product-cell" key="p">
                    {p.image ? <img src={p.image} alt="" /> : <span className="adm-thumb-empty"><Icon name="products" size={18} /></span>}
                    <span>{p.name}</span>
                  </div>,
                  p.category, money(p.price), p.stock,
                  <Badge key="s" value={p.active ? "active" : "inactive"} />,
                  <div className="adm-actions" key="a">
                    <button className="adm-btn ghost sm" onClick={() => setEditing(p)}><Icon name="edit" size={15} />Editar</button>
                    <button className="adm-btn ghost danger sm" onClick={() => remove(p)} aria-label={`Eliminar ${p.name}`}><Icon name="trash" size={15} />Eliminar</button>
                  </div>,
                ],
              }))}
            />
          ) : <Empty icon="products" text="Nenhum produto cadastrado." />}
        </section>
      )}
      {editing && <ProductModal product={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void reload(); }} />}
    </>
  );
}

/** Foto no formulário do produto: `file` só existe nas fotos novas (ainda por enviar ao servidor). */
type Photo = { key: string; url: string; file?: File; original?: File; processing?: boolean; progress?: number };

class TimeoutError extends Error { }
const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new TimeoutError("timeout")), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });

function ProductModal({ product, onClose, onSaved }: { product: Product; onClose: () => void; onSaved: () => void }) {
  // Preço e stock ficam como texto no formulário (assim dá para apagar o "0" ao escrever).
  const [form, setForm] = useState<{ name: string; category: string; description: string; price: string; stock: string; active: boolean; sections: HomeSectionSlug[] }>({ name: product.name, category: product.category, description: product.description, price: String(product.price), stock: String(product.stock), active: product.active, sections: [] });
  // Especificações do produto (linhas "característica / valor"), por ordem.
  const [specs, setSpecs] = useState<ProductSpec[]>(() => (product.specs ?? []).map((x) => ({ label: x.label, value: x.value })));
  const setSpec = (i: number, k: keyof ProductSpec, v: string) => setSpecs((cur) => cur.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const addSpec = () => setSpecs((cur) => (cur.length >= MAX_PRODUCT_SPECS ? cur : [...cur, { label: "", value: "" }]));
  const removeSpec = (i: number) => setSpecs((cur) => cur.filter((_, j) => j !== i));
  // Só grava as secções se foram carregadas (evita apagar as existentes ao editar).
  const [sectionsReady, setSectionsReady] = useState(!product.id);
  // Fotos do produto, por ordem: a primeira é a principal. `file` só existe nas fotos novas (ainda por enviar).
  const [photos, setPhotos] = useState<Photo[]>(() =>
    [product.image, ...(product.images ?? [])].filter(Boolean).map((url, i) => ({ key: `old-${i}`, url })));
  const photosRef = useRef(photos);
  photosRef.current = photos;
  // Liberta as pré-visualizações (blob:) ao fechar o formulário.
  useEffect(() => () => photosRef.current.forEach((p) => { if (p.file) URL.revokeObjectURL(p.url); }), []);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  // true enquanto a foto escolhida está a ser reduzida/convertida no navegador.
  const [optimizing, setOptimizing] = useState(false);
  // Remover o fundo das fotos novas automaticamente (ligado por defeito; a escolha fica guardada neste navegador).
  const [removeBg, setRemoveBg] = useState(() => { try { return localStorage.getItem("adm-remove-bg") !== "0"; } catch { return true; } });
  const [photoNote, setPhotoNote] = useState("");
  const toggleRemoveBg = (on: boolean) => { setRemoveBg(on); try { localStorage.setItem("adm-remove-bg", on ? "1" : "0"); } catch { /* ignora */ } };

  useEffect(() => {
    if (!product.id) return;
    homeApi.productSections(product.id)
      .then(({ sections }) => { setForm((f) => ({ ...f, sections })); setSectionsReady(true); })
      .catch((e) => setError(errorText(e)));
  }, [product.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  // Categorias da loja; acrescenta a categoria atual do produto se for um valor antigo/personalizado.
  // Vêm do painel (base de dados); enquanto carregam, ou se falhar, usa a lista fixa da loja.
  const [catNames, setCatNames] = useState<string[]>(() => Object.keys(categories));
  useEffect(() => {
    adminApi.categories().then(({ categories: rows }) => { if (rows.length) setCatNames(rows.map((r) => r.name)); }).catch(() => { });
  }, []);
  const categoryOptions = [...catNames];
  if (product.category && !categoryOptions.includes(product.category)) categoryOptions.push(product.category);
  // Adicionar fotos (várias de uma vez): cada uma é reduzida e convertida para WebP no navegador.
  const addPhotos = async (list: FileList | null) => {
    const files = Array.from(list ?? []);
    if (!files.length) return;
    setError("");
    setPhotoNote("");
    const room = MAX_PRODUCT_PHOTOS - photos.length;
    if (room <= 0) { setPhotoNote(`Cada produto pode ter no máximo ${MAX_PRODUCT_PHOTOS} fotos.`); return; }
    setOptimizing(true);
    const added: Photo[] = [];
    const jobs: { key: string; file: File }[] = [];
    let problem = files.length > room ? `Só cabem mais ${room} foto(s) neste produto; as restantes foram ignoradas.` : "";
    // 1.º: cada foto aparece logo no formulário (reduzida, com o fundo original).
    for (const f of files.slice(0, room)) {
      try {
        const plain = await optimizeProductImage(f);
        const key = `new-${Math.random().toString(36).slice(2)}`;
        added.push({ key, url: URL.createObjectURL(plain), file: plain, processing: removeBg, progress: 0 });
        jobs.push({ key, file: f });
      } catch (err) {
        problem = errorText(err);
      }
    }
    if (added.length) setPhotos((cur) => [...cur, ...added]);
    if (problem) setPhotoNote(problem);
    setOptimizing(false);
    if (!removeBg) return;

    // 2.º: o fundo é removido uma foto de cada vez, em segundo plano. Se falhar ou demorar demais,
    // a foto fica como está (com o fundo original) e aparece um aviso junto às fotos.
    for (const job of jobs) {
      const plain = added.find((a) => a.key === job.key)!.file!;
      try {
        const cut = await withTimeout(
          optimizeProductImage(job.file, {
            removeBg: true,
            onProgress: (fr) => setPhotos((cur) => cur.map((x) => (x.key === job.key ? { ...x, progress: fr } : x))),
          }),
          180_000,
        );
        if (!photosRef.current.some((x) => x.key === job.key)) continue; // foi removida entretanto
        const url = URL.createObjectURL(cut);
        setPhotos((cur) => cur.map((x) => {
          if (x.key !== job.key) return x;
          URL.revokeObjectURL(x.url);
          return { key: x.key, url, file: cut, original: plain };
        }));
      } catch (err) {
        console.warn("[remover-fundo]", err);
        setPhotoNote(err instanceof TimeoutError
          ? "A remoção do fundo demorou demasiado (verifique a internet); a foto ficou com o fundo original."
          : errorText(err));
        setPhotos((cur) => cur.map((x) => (x.key === job.key ? { ...x, processing: false } : x)));
      }
    }
  };
  // Mudar a ordem (mover a foto 1 casa); a que ficar em primeiro lugar passa a ser a principal.
  const movePhoto = (i: number, dir: -1 | 1) => setPhotos((cur) => {
    const j = i + dir;
    if (j < 0 || j >= cur.length) return cur;
    const next = [...cur];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });
  // Voltar à foto original (com o fundo), caso o recorte automático não tenha ficado bem.
  const restoreOriginal = (i: number) => setPhotos((cur) => cur.map((ph, k) => {
    if (k !== i || !ph.original) return ph;
    URL.revokeObjectURL(ph.url);
    return { key: ph.key, url: URL.createObjectURL(ph.original), file: ph.original };
  }));
  const removePhoto = (i: number) => setPhotos((cur) => {
    if (cur[i]?.file) URL.revokeObjectURL(cur[i].url);
    return cur.filter((_, k) => k !== i);
  });

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      // Envia as fotos novas (por ordem) e junta com as que já estavam guardadas.
      const urls: string[] = [];
      for (const ph of photos) urls.push(ph.file ? await uploadProductImage(ph.file) : ph.url);
      const payload: ProductInput = { name: form.name, category: form.category, description: form.description, price: Number(form.price), stock: Number(form.stock), image: urls[0] ?? "", active: form.active };
      // `images` (fotos extra) só segue quando há extras ou quando se removeram os que existiam;
      // assim os produtos com uma só foto continuam a enviar exatamente o mesmo de antes.
      if (urls.length > 1 || (product.images?.length ?? 0) > 0) payload.images = urls.slice(1);
      // Especificações: ignora linhas vazias. Só segue quando há especificações ou quando se apagaram
      // as que existiam; assim os produtos sem especificações enviam exatamente o mesmo de antes.
      const cleanSpecs = specs.map((x) => ({ label: x.label.trim(), value: x.value.trim() })).filter((x) => x.label && x.value);
      if (cleanSpecs.length > 0 || (product.specs?.length ?? 0) > 0) payload.specs = cleanSpecs;
      let id = product.id;
      if (id) await adminApi.updateProduct(id, payload);
      else id = (await adminApi.createProduct(payload)).product.id;
      if (sectionsReady) await homeApi.setProductSections(id, form.sections);
      onSaved();
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  };

  return (
    <div className="adm-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <form className="adm-modal" onSubmit={save} role="dialog" aria-modal="true" aria-labelledby="adm-modal-title">
        <div className="adm-modal-head">
          <h2 id="adm-modal-title">{product.id ? "Editar produto" : "Novo produto"}</h2>
          <button type="button" className="adm-icon-btn" onClick={onClose} disabled={busy} aria-label="Fechar"><Icon name="close" /></button>
        </div>
        <div className="adm-form-grid">
          <label>Nome<input value={form.name} onChange={(e) => set("name", onlyLabelText(120)(e.target.value))} required minLength={2} maxLength={120} autoFocus /></label>
          {/* Filtro de categoria: lista as mesmas categorias da loja. Se o produto já tiver uma categoria
              antiga que não está na lista, ela é mantida como opção para não se perder ao editar. */}
          <label>Categoria
            <select value={form.category} onChange={(e) => set("category", e.target.value)} required>
              <option value="" disabled>Escolha a categoria…</option>
              {categoryOptions.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label>Preço (MT)<input type="text" inputMode="decimal" autoComplete="off" pattern="\d+(\.\d{1,2})?" value={form.price} onChange={(e) => set("price", onlyMoney(e.target.value))} required />
            {form.sections.includes("featured") && <small>Este preço aparece em destaque sobre a imagem do hero.</small>}
          </label>
          <label>Stock<input className="adm-stock-input" type="text" inputMode="numeric" autoComplete="off" pattern="\d+" value={form.stock} onChange={(e) => set("stock", onlyInt(e.target.value))} required /></label>
          <div className="wide">
            <span className="adm-label">Fotos do produto <small>({photos.length}/{MAX_PRODUCT_PHOTOS})</small></span>
            <div className="adm-photos">
              {photos.map((ph, i) => (
                <div className={"adm-photo" + (i === 0 ? " main" : "")} key={ph.key}>
                  <img src={ph.url} alt={`Foto ${i + 1}`} />
                  {ph.processing && (
                    <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", background: "rgba(255,255,255,.78)", fontSize: 11, fontWeight: 700, textAlign: "center", padding: 6 }}>
                      A remover o fundo… {Math.round((ph.progress ?? 0) * 100)}%
                    </div>
                  )}
                  {i === 0 && <span className="adm-photo-badge">Principal</span>}
                  <div className="adm-photo-tools">
                    <button type="button" onClick={() => movePhoto(i, -1)} disabled={i === 0 || busy} aria-label="Mover para trás"><Icon name="left" size={14} /></button>
                    <button type="button" onClick={() => movePhoto(i, 1)} disabled={i === photos.length - 1 || busy} aria-label="Mover para a frente"><Icon name="right" size={14} /></button>
                    {ph.original && <button type="button" onClick={() => restoreOriginal(i)} disabled={busy} aria-label="Voltar à foto original (com fundo)" title="Voltar à foto original (com fundo)">↶</button>}
                    <button type="button" className="danger" onClick={() => removePhoto(i)} disabled={busy} aria-label="Remover foto"><Icon name="trash" size={14} /></button>
                  </div>
                </div>
              ))}
              {photos.length < MAX_PRODUCT_PHOTOS && (
                <label className="adm-photo-add">
                  <Icon name="plus" size={20} />
                  <span>{optimizing ? "A preparar…" : "Adicionar fotos"}</span>
                  <input type="file" multiple accept="image/jpeg,image/png,image/webp,image/avif" disabled={optimizing || busy} onChange={(e) => { void addPhotos(e.target.files); e.target.value = ""; }} />
                </label>
              )}
            </div>
            {photoNote && <div role="alert" style={{ marginTop: 8, padding: "8px 10px", borderRadius: 8, background: "#fff1f1", color: "#b00020", fontSize: 13 }}>{photoNote}</div>}
            <label className="adm-check">
              <input type="checkbox" checked={removeBg} disabled={optimizing || busy} onChange={(e) => toggleRemoveBg(e.target.checked)} />
              Remover o fundo das fotos automaticamente
            </label>
            <small className="adm-photos-help">A 1.ª foto é a principal (aparece nos cartões). Use as setas para mudar a ordem. JPG, PNG, WebP ou AVIF; as fotos são reduzidas automaticamente.</small>
          </div>
          <label className="wide">Descrição<textarea rows={4} value={form.description} onChange={(e) => set("description", e.target.value)} /></label>
          <div className="wide">
            <span className="adm-label">Especificações do produto <small>({specs.length}/{MAX_PRODUCT_SPECS})</small></span>
            {specs.length > 0 && (
              <div className="adm-specs-list">
                {specs.map((sp, i) => (
                  <div className="adm-spec-row" key={i}>
                    <input value={sp.label} onChange={(e) => setSpec(i, "label", onlyLabelText(60)(e.target.value))} maxLength={60} aria-label={`Característica ${i + 1}`} disabled={busy} />
                    <input value={sp.value} onChange={(e) => setSpec(i, "value", e.target.value)} maxLength={200} aria-label={`Valor ${i + 1}`} disabled={busy} />
                    <button type="button" className="adm-icon-btn" onClick={() => removeSpec(i)} disabled={busy} aria-label={`Remover especificação ${i + 1}`}><Icon name="trash" size={16} /></button>
                  </div>
                ))}
              </div>
            )}
            {specs.length < MAX_PRODUCT_SPECS && (
              <button type="button" className="adm-btn ghost sm adm-spec-add" onClick={addSpec} disabled={busy}><Icon name="plus" size={15} />Adicionar especificação</button>
            )}
            <small className="adm-photos-help">Aparecem numa tabela na página do produto, pela ordem indicada. Linhas com a característica ou o valor em branco são ignoradas.</small>
          </div>
          <fieldset className="wide adm-sections">
            <legend className="adm-label">Mostrar na página inicial</legend>
            {HOME_SECTION_META.map((m) => (
              <label key={m.slug} className="adm-check">
                <input
                  type="checkbox"
                  disabled={!sectionsReady || busy}
                  checked={form.sections.includes(m.slug)}
                  onChange={(e) => set("sections", e.target.checked ? [...form.sections, m.slug] : form.sections.filter((x) => x !== m.slug))}
                />
                {m.title}{m.limit === 1 ? " (substitui o atual)" : ""}
              </label>
            ))}
          </fieldset>
          <label className="adm-check wide"><input type="checkbox" checked={form.active} onChange={(e) => set("active", e.target.checked)} />Produto ativo (visível na loja)</label>
        </div>
        {error && <Notice>{error}</Notice>}
        <div className="adm-modal-actions">
          <button type="button" className="adm-btn ghost" onClick={onClose} disabled={busy}>Cancelar</button>
          <button className="adm-btn" disabled={busy || optimizing || photos.some((x) => x.processing)}>{busy ? "A guardar…" : "Guardar produto"}</button>
        </div>
      </form>
    </div>
  );
}

/* ========================================================================== */
/* Categorias: criar, editar e eliminar (só o texto; o ícone é automático)     */
/* ========================================================================== */
const fetchCategories = () => adminApi.categories().then((r) => r.categories);
const NEW_CATEGORY: Category = { id: "", name: "", icon: "", position: 0, productCount: 0 };

function CategoriesView() {
  const { data: items, error, setError, reload } = useLoad<Category[]>(fetchCategories);
  const [editing, setEditing] = useState<Category | null>(null);

  const remove = async (c: Category) => {
    if (!confirm(`Eliminar a categoria "${c.name}"?`)) return;
    try { await adminApi.deleteCategory(c.id); setError(""); await reload(); } catch (e) { setError(errorText(e)); }
  };

  return (
    <>
      <PageTitle title="Categorias" text="Crie e edite as categorias da loja."
        action={<button className="adm-btn" onClick={() => setEditing(NEW_CATEGORY)}><Icon name="plus" size={16} />Nova categoria</button>} />
      {error && <Notice>{error}</Notice>}
      {!items ? (!error && <Loading text="A carregar categorias…" />) : (
        <section className="adm-card">
          {items.length ? (
            <DataTable
              headers={["Categoria", "Produtos", "Ações"]}
              rows={items.map((c) => ({
                key: c.id,
                cells: [
                  <span key="c">{c.name}</span>,
                  c.productCount,
                  <div className="adm-actions" key="a">
                    <button className="adm-btn ghost sm" onClick={() => setEditing(c)}><Icon name="edit" size={15} />Editar</button>
                    <button className="adm-btn ghost danger sm" onClick={() => remove(c)} aria-label={`Eliminar ${c.name}`}><Icon name="trash" size={15} />Eliminar</button>
                  </div>,
                ],
              }))}
            />
          ) : <Empty icon="categories" text="Nenhuma categoria criada." />}
        </section>
      )}
      {editing && <CategoryModal category={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void reload(); }} />}
    </>
  );
}

function CategoryModal({ category, onClose, onSaved }: { category: Category; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(category.name);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const clean = name.trim();
      // O administrador só escreve o nome; a loja desenha o ícone a partir dele.
      if (!category.id) await adminApi.createCategory({ name: clean, icon: suggestIconKey(clean) });
      else await adminApi.updateCategory(category.id, clean === category.name ? { name: clean } : { name: clean, icon: suggestIconKey(clean) });
      onSaved();
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  };

  return (
    <div className="adm-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <form className="adm-modal" onSubmit={save} role="dialog" aria-modal="true" aria-labelledby="adm-cat-title">
        <div className="adm-modal-head">
          <h2 id="adm-cat-title">{category.id ? "Editar categoria" : "Nova categoria"}</h2>
          <button type="button" className="adm-icon-btn" onClick={onClose} disabled={busy} aria-label="Fechar"><Icon name="close" /></button>
        </div>
        <div className="adm-form-grid">
          <label className="wide">Nome da categoria
            <input value={name} onChange={(e) => setName(onlyLabelText(60)(e.target.value))} required minLength={2} maxLength={60} autoFocus />
            {category.id && category.productCount > 0 && name.trim() !== category.name && (
              <small>Os {category.productCount} produto(s) desta categoria passam a usar o nome novo.</small>
            )}
          </label>
        </div>
        {error && <Notice>{error}</Notice>}
        <div className="adm-modal-actions">
          <button type="button" className="adm-btn ghost" onClick={onClose} disabled={busy}>Cancelar</button>
          <button className="adm-btn" disabled={busy || name.trim().length < 2}>{busy ? "A guardar…" : "Guardar categoria"}</button>
        </div>
      </form>
    </div>
  );
}

/* ========================================================================== */
/* Página inicial: produtos de cada secção (incluindo o produto em destaque)  */
/* ========================================================================== */
const fetchHome = () => homeApi.sections().then((r) => r.sections);

function HomeSectionsView() {
  const { data: sections, setData, error, setError } = useLoad<HomeSection[]>(fetchHome);
  const fetchAll = useCallback(() => adminApi.products().then((r) => r.products), []);
  const { data: catalog } = useLoad<Product[]>(fetchAll);
  const [pick, setPick] = useState<Record<string, string>>({});

  const replaceSection = (section: HomeSection) => setData((list) => (list ?? []).map((x) => (x.slug === section.slug ? section : x)));
  const add = async (slug: HomeSectionSlug) => {
    const productId = pick[slug];
    if (!productId) return;
    try { replaceSection((await homeApi.addToSection(slug, productId)).section); setPick((p) => ({ ...p, [slug]: "" })); setError(""); } catch (e) { setError(errorText(e)); }
  };
  const remove = async (slug: HomeSectionSlug, p: Product) => {
    try { await homeApi.removeFromSection(slug, p.id); setData((list) => (list ?? []).map((x) => (x.slug === slug ? { ...x, products: x.products.filter((y) => y.id !== p.id) } : x))); setError(""); } catch (e) { setError(errorText(e)); }
  };
  const move = async (section: HomeSection, index: number, dir: -1 | 1) => {
    const ids = section.products.map((p) => p.id);
    const j = index + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[index], ids[j]] = [ids[j], ids[index]];
    try { replaceSection((await homeApi.setSection(section.slug, ids)).section); setError(""); } catch (e) { setError(errorText(e)); }
  };

  return (
    <>
      <PageTitle title="Página inicial" text="Escolha os produtos que aparecem em cada secção da loja." />
      {error && <Notice>{error}</Notice>}
      {!sections ? (!error && <Loading text="A carregar secções…" />) : sections.map((section) => {
        const free = (catalog ?? []).filter((p) => !section.products.some((x) => x.id === p.id));
        const full = section.products.length >= section.limit && section.limit > 1;
        return (
          <section className="adm-card" key={section.slug}>
            <div className="adm-card-head">
              <h2>{section.title}</h2>
              <small>{section.limit === 1 ? "1 produto" : `${section.products.length}/${section.limit} produtos`}</small>
            </div>
            {section.products.length ? (
              <DataTable
                headers={section.limit === 1 ? ["Produto", "Preço", "Ações"] : ["Produto", "Preço", "Ordem", "Ações"]}
                rows={section.products.map((p, i) => ({
                  key: p.id,
                  cells: [
                    <div className="adm-product-cell" key="p">
                      {p.image ? <img src={p.image} alt="" /> : <span className="adm-thumb-empty"><Icon name="products" size={18} /></span>}
                      <span>{p.name}{!p.active && <> <Badge value="inactive" /></>}</span>
                    </div>,
                    money(p.price),
                    ...(section.limit === 1 ? [] : [
                      <div className="adm-actions" key="o">
                        <button className="adm-btn ghost sm" onClick={() => move(section, i, -1)} disabled={i === 0} aria-label={`Subir ${p.name}`}>↑</button>
                        <button className="adm-btn ghost sm" onClick={() => move(section, i, 1)} disabled={i === section.products.length - 1} aria-label={`Descer ${p.name}`}>↓</button>
                      </div>,
                    ]),
                    <button className="adm-btn ghost danger sm" key="a" onClick={() => remove(section.slug, p)}><Icon name="trash" size={15} />Tirar</button>,
                  ],
                }))}
              />
            ) : <Empty icon="products" text="Nenhum produto nesta secção." />}
            <div className="adm-actions" style={{ padding: "12px 16px" }}>
              <select className="adm-select" value={pick[section.slug] ?? ""} onChange={(e) => setPick((p) => ({ ...p, [section.slug]: e.target.value }))} disabled={!catalog || full} aria-label={`Produto a adicionar a ${section.title}`}>
                <option value="">{full ? "Secção cheia" : section.limit === 1 ? "Escolher o produto em destaque…" : "Adicionar produto…"}</option>
                {free.map((p) => <option key={p.id} value={p.id}>{p.name}{p.active ? "" : " (inativo)"}</option>)}
              </select>
              <button className="adm-btn sm" onClick={() => add(section.slug)} disabled={!pick[section.slug]}><Icon name="plus" size={15} />{section.limit === 1 ? "Definir" : "Adicionar"}</button>
            </div>
          </section>
        );
      })}
    </>
  );
}

/* ========================================================================== */
/* Clientes                                                                   */
/* ========================================================================== */
const fetchCustomers = () => adminApi.customers().then((r) => r.customers);

function CustomersView() {
  const { data: items, error } = useLoad<Customer[]>(fetchCustomers);
  return (
    <>
      <PageTitle title="Clientes" text="Contas registadas na plataforma." />
      {error && <Notice>{error}</Notice>}
      {!items ? (!error && <Loading text="A carregar clientes…" />) : (
        <section className="adm-card">
          {items.length ? (
            <DataTable
              headers={["Nome", "E-mail", "Telefone", "Registo"]}
              rows={items.map((c) => ({ key: c.id, cells: [c.name, c.email || "—", c.phone || "—", date(c.createdAt)] }))}
            />
          ) : <Empty icon="customers" text="Nenhum cliente registado." />}
        </section>
      )}
    </>
  );
}

/* ========================================================================== */
/* Pedidos                                                                    */
/* ========================================================================== */
const fetchOrders = () => adminApi.orders().then((r) => r.orders);
const ORDER_STATES = ["pending", "paid", "processing", "shipped", "completed", "cancelled"] as const;
/** Estados "em curso": o pedido ainda não foi entregue nem cancelado. */
const OPEN_STATES: string[] = ["pending", "paid", "processing", "shipped"];
/** Próximo passo natural de cada estado — vira o botão de ação rápida da linha. */
const NEXT_STEP: Record<string, { to: string; label: string } | undefined> = {
  pending: { to: "paid", label: "Marcar pago" },
  paid: { to: "processing", label: "Processar" },
  processing: { to: "shipped", label: "Enviar" },
  shipped: { to: "completed", label: "Concluir" },
};

type StatusFilter = "all" | "open" | (typeof ORDER_STATES)[number];
type Period = "all" | "today" | "7d" | "30d";
type Sort = "recent" | "oldest" | "high" | "low";

const STATUS_CHIPS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "Todos" }, { key: "open", label: "Em curso" },
  ...ORDER_STATES.map((st) => ({ key: st as StatusFilter, label: STATUS_LABELS[st] })),
];
const PERIODS: { key: Period; label: string }[] = [
  { key: "all", label: "Qualquer data" }, { key: "today", label: "Hoje" }, { key: "7d", label: "Últimos 7 dias" }, { key: "30d", label: "Últimos 30 dias" },
];
const SORTS: { key: Sort; label: string }[] = [
  { key: "recent", label: "Mais recentes" }, { key: "oldest", label: "Mais antigos" }, { key: "high", label: "Maior valor" }, { key: "low", label: "Menor valor" },
];

const shortRef = (id: string) => `#${id.slice(0, 8)}`;
const dateTime = (v: string) => new Date(v).toLocaleString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
const hhmm = (d: Date) => d.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
const inPeriod = (iso: string, p: Period) => {
  if (p === "all") return true;
  const t = new Date(iso).getTime();
  if (p === "today") { const n = new Date(); return t >= new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime(); }
  return t >= Date.now() - (p === "7d" ? 7 : 30) * 86_400_000;
};
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
/** +258841234567 → +258 84 123 4567 */
/* Filtros dos campos: o que o campo não aceita nem chega a aparecer quando se escreve. */
/** Nome de pessoa: letras (com acentos), espaços, apóstrofo e hífen. */
const onlyPersonText = (v: string) => v.replace(/[^\p{L}\s'’-]/gu, "").replace(/^\s+/, "").replace(/\s{2,}/g, " ").slice(0, 100);
/** Telefone: só dígitos (9) e, se colarem "+258…", o prefixo é descartado. Guarda-se como +258XXXXXXXXX ao gravar. */
const onlyPhoneDigits = (v: string) => { const d = v.replace(/\D/g, ""); return (d.length > 9 && d.startsWith("258") ? d.slice(3) : d).slice(0, 9); };
/** Veículo e nome de categoria: letras, números, espaços e - . ' & */
const onlyLabelText = (max: number) => (v: string) => v.replace(/[^\p{L}\d\s'’.&-]/gu, "").replace(/^\s+/, "").replace(/\s{2,}/g, " ").slice(0, max);
/** Preço: só dígitos e uma vírgula/ponto com até 2 casas decimais. */
const onlyMoney = (v: string) => { const t = v.replace(",", ".").replace(/[^\d.]/g, ""); const [i = "", ...rest] = t.split("."); return rest.length ? `${i}.${rest.join("").slice(0, 2)}` : i; };
/** Stock: só dígitos (número inteiro). */
const onlyInt = (v: string) => v.replace(/\D/g, "").slice(0, 7);

const fmtPhone = (p: string) => p.replace(/^\+258(\d{2})(\d{3})(\d{4})$/, "+258 $1 $2 $3");
/** Pedidos nestes estados ainda podem receber (ou trocar) o entregador. */
const canAssign = (status: string) => OPEN_STATES.includes(status);
/** Já saiu da loja ou está a sair: devia ter entregador. */
const needsDriver = (o: Order) => !o.driver && (o.status === "processing" || o.status === "shipped");

/**
 * Pedidos do painel. O administrador pode:
 *  - filtrar por estado (com contagens), forma de pagamento e período, pesquisar (referência, cliente, e-mail, morada, produto) e ordenar;
 *  - abrir cada pedido para ver os artigos, a morada e os dados de entrega/pagamento;
 *  - avançar o pedido com um clique (Marcar pago → Processar → Enviar → Concluir) ou escolher qualquer estado;
 *  - selecionar vários pedidos para mudar o estado ou eliminar de uma vez;
 *  - atribuir (ou trocar) o entregador de cada pedido em curso e filtrar por entregador / "sem entregador";
 *  - ver, no detalhe do pedido, a linha do tempo com as mudanças de estado e de entregador;
 *  - eliminar um pedido (os não enviados devolvem o stock à loja).
 * A lista atualiza-se sozinha de 30 em 30 s, por isso novos pedidos aparecem sem recarregar a página.
 */
function OrdersView() {
  const { data: items, setData, error, setError } = useLoad<Order[]>(fetchOrders);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [payment, setPayment] = useState("all");
  const [period, setPeriod] = useState<Period>("all");
  const [sort, setSort] = useState<Sort>("recent");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openId, setOpenId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null); // id do pedido, ou "bulk" para os selecionados
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState("");
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [driverFilter, setDriverFilter] = useState("all"); // "all" | "none" | id do entregador
  const [timelineKey, setTimelineKey] = useState(0);        // muda sempre que algo altera o histórico → as linhas do tempo abertas recarregam

  const loadDrivers = () => adminApi.drivers().then((r) => setDrivers(r.drivers)).catch(() => { /* a lista de pedidos continua a funcionar sem esta */ });
  useEffect(() => { void loadDrivers(); }, []);

  useEffect(() => { if (items && !updatedAt) setUpdatedAt(new Date()); }, [items, updatedAt]);

  const flash = (message: string) => { setInfo(message); window.setTimeout(() => setInfo(""), 5000); };

  /** Vai buscar a lista outra vez. `silent` = refresh automático (não mostra erros nem o estado "A atualizar"). */
  const refresh = async (silent: boolean) => {
    if (!silent) setRefreshing(true);
    try {
      const { orders } = await adminApi.orders();
      setData(orders);
      void loadDrivers();
      setTimelineKey((k) => k + 1);
      setUpdatedAt(new Date());
      setSelected((prev) => new Set([...prev].filter((id) => orders.some((o) => o.id === id))));
      if (!silent) setError("");
    } catch (e) {
      if (!silent) setError(errorText(e));
    } finally {
      if (!silent) setRefreshing(false);
    }
  };

  useEffect(() => {
    const timer = window.setInterval(() => { if (!document.hidden && !busy) void refresh(true); }, 30_000);
    return () => window.clearInterval(timer);
  }, [busy]);

  const all = items ?? [];
  const countOf = (f: StatusFilter) => (f === "all" ? all.length : f === "open" ? all.filter((o) => OPEN_STATES.includes(o.status)).length : all.filter((o) => o.status === f).length);
  const payments = [...new Set(all.map((o) => o.paymentMethod).filter((p): p is string => Boolean(p)))];

  const q = query.trim().toLowerCase();
  const visible = all
    .filter((o) => {
      if (status === "open" ? !OPEN_STATES.includes(o.status) : status !== "all" && o.status !== status) return false;
      if (payment !== "all" && o.paymentMethod !== payment) return false;
      if (driverFilter === "none" ? o.driver : driverFilter !== "all" && o.driver?.id !== driverFilter) return false;
      if (!inPeriod(o.createdAt, period)) return false;
      if (q) {
        const haystack = [o.id, o.customer, o.email, o.shippingAddress ?? "", o.driver?.name ?? "", ...(o.items ?? []).map((i) => i.name)].join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => sort === "oldest" ? +new Date(a.createdAt) - +new Date(b.createdAt) : sort === "high" ? b.total - a.total : sort === "low" ? a.total - b.total : +new Date(b.createdAt) - +new Date(a.createdAt));

  const filtersActive = status !== "all" || payment !== "all" || period !== "all" || driverFilter !== "all" || q !== "";
  const clearFilters = () => { setStatus("all"); setPayment("all"); setPeriod("all"); setDriverFilter("all"); setQuery(""); };
  const waiting = all.filter(needsDriver).length; // em processamento/enviados e ainda sem entregador
  const worth = visible.filter((o) => o.status !== "cancelled").reduce((n, o) => n + o.total, 0);

  // Seleção: as ações em massa só atuam nos pedidos selecionados que estão visíveis.
  const visibleIds = visible.map((o) => o.id);
  const chosen = visibleIds.filter((id) => selected.has(id));
  const allSelected = visibleIds.length > 0 && chosen.length === visibleIds.length;
  const toggle = (id: string) => setSelected((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleAll = () => setSelected((prev) => { const n = new Set(prev); visibleIds.forEach((id) => (allSelected ? n.delete(id) : n.add(id))); return n; });

  const drop = (ids: string[]) => {
    const gone = new Set(ids);
    setData((list) => (list ?? []).filter((o) => !gone.has(o.id)));
    setSelected((prev) => new Set([...prev].filter((id) => !gone.has(id))));
    setOpenId((cur) => (cur && gone.has(cur) ? null : cur));
  };

  const update = async (id: string, next: string) => {
    setBusy(true); setError("");
    try {
      const { order } = await adminApi.updateOrderStatus(id, next);
      setData((list) => (list ?? []).map((o) => (o.id === id ? { ...o, ...order, status: next } : o)));
      setTimelineKey((k) => k + 1);
      void loadDrivers(); // as entregas em curso de cada entregador mudam com o estado
    } catch (e) {
      setError(errorText(e));
    } finally { setBusy(false); }
  };

  const bulkStatus = async (next: string) => {
    if (!next || chosen.length === 0) return;
    setBusy(true); setError("");
    try {
      const { updated, skipped } = await adminApi.bulkOrderStatus(chosen, next);
      const byId = new Map(updated.map((o) => [o.id, o.status]));
      setData((list) => (list ?? []).map((o) => (byId.has(o.id) ? { ...o, status: byId.get(o.id)! } : o)));
      setSelected(new Set());
      setTimelineKey((k) => k + 1);
      void loadDrivers();
      flash(`${plural(updated.length, "pedido atualizado", "pedidos atualizados")}${skipped ? ` · ${plural(skipped, "ficou", "ficaram")} de fora (pedidos cancelados não reabrem)` : ""}.`);
    } catch (e) {
      setError(errorText(e));
    } finally { setBusy(false); }
  };

  /** Atribui (ou, com "", retira) o entregador de um pedido em curso. */
  const assign = async (id: string, driverId: string) => {
    setBusy(true); setError("");
    try {
      const { order } = await adminApi.assignDriver(id, driverId || null);
      setData((list) => (list ?? []).map((o) => (o.id === id ? { ...o, driver: order.driver, driverAssignedAt: order.driverAssignedAt } : o)));
      setTimelineKey((k) => k + 1);
      void loadDrivers();
      flash(order.driver ? `Pedido ${shortRef(id)} atribuído a ${order.driver.name}.` : `Entregador retirado do pedido ${shortRef(id)}.`);
    } catch (e) {
      setError(errorText(e));
    } finally { setBusy(false); }
  };

  const removeOne = async (id: string) => {
    setBusy(true); setError("");
    try {
      await adminApi.deleteOrder(id);
      drop([id]);
      flash("Pedido eliminado.");
    } catch (e) {
      setError(errorText(e));
    } finally { setBusy(false); setConfirm(null); }
  };

  const removeMany = async () => {
    setBusy(true); setError("");
    try {
      const { deleted } = await adminApi.bulkDeleteOrders(chosen);
      drop(deleted);
      flash(`${plural(deleted.length, "pedido eliminado", "pedidos eliminados")}.`);
    } catch (e) {
      setError(errorText(e));
    } finally { setBusy(false); setConfirm(null); }
  };

  return (
    <>
      <PageTitle
        title="Pedidos"
        text="Acompanhe, filtre e gira os pedidos realizados pelos clientes."
        action={<button className="adm-btn ghost sm" onClick={() => void refresh(false)} disabled={refreshing}>{refreshing ? "A atualizar…" : "Atualizar"}</button>}
      />
      {error && <Notice>{error}</Notice>}
      {info && <div className="adm-flash" role="status">{info}</div>}
      {!items ? (!error && <Loading text="A carregar pedidos…" />) : (
        <section className="adm-card">
          {/* Estados com contagem: um clique filtra a lista. */}
          <div className="adm-chips" role="group" aria-label="Filtrar por estado">
            {STATUS_CHIPS.map((c) => (
              <button key={c.key} type="button" className={`adm-chip ${status === c.key ? "on" : ""}`} aria-pressed={status === c.key} onClick={() => setStatus(c.key)}>
                {c.label}<b>{countOf(c.key)}</b>
              </button>
            ))}
          </div>

          <div className="adm-toolbar">
            <input type="search" className="adm-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Pesquisar por referência, cliente, morada ou produto" aria-label="Pesquisar pedidos" maxLength={80} />
            <select className="adm-select" value={payment} onChange={(e) => setPayment(e.target.value)} aria-label="Filtrar por forma de pagamento">
              <option value="all">Todos os pagamentos</option>
              {payments.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <select className="adm-select" value={period} onChange={(e) => setPeriod(e.target.value as Period)} aria-label="Filtrar por período">
              {PERIODS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
            <select className="adm-select" value={driverFilter} onChange={(e) => setDriverFilter(e.target.value)} aria-label="Filtrar por entregador">
              <option value="all">Todos os entregadores</option>
              <option value="none">Sem entregador</option>
              {drivers.map((d) => <option key={d.id} value={d.id}>{d.name}{d.active ? "" : " (inativo)"}</option>)}
            </select>
            <select className="adm-select" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Ordenar pedidos">
              {SORTS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
            </select>
            {filtersActive && <button type="button" className="adm-link" onClick={clearFilters}>Limpar filtros</button>}
          </div>

          <p className="adm-summary">
            {visible.length} de {plural(all.length, "pedido", "pedidos")} · Valor (sem cancelados): <strong>{money(worth)}</strong>
            {updatedAt && <span> · Atualizado às {hhmm(updatedAt)}</span>}
            {waiting > 0 && (
              <> · <button type="button" className="adm-link adm-warn" onClick={() => { setStatus("open"); setDriverFilter("none"); }}>{plural(waiting, "pedido a sair sem entregador", "pedidos a sair sem entregador")}</button></>
            )}
          </p>

          {chosen.length > 0 && (
            <div className="adm-bulk" role="region" aria-label="Ações sobre os pedidos selecionados">
              <strong>{plural(chosen.length, "selecionado", "selecionados")}</strong>
              <select className="adm-select" value="" disabled={busy} onChange={(e) => void bulkStatus(e.target.value)} aria-label="Alterar o estado dos pedidos selecionados">
                <option value="">Alterar estado…</option>
                {ORDER_STATES.map((st) => <option key={st} value={st}>{STATUS_LABELS[st]}</option>)}
              </select>
              {confirm === "bulk" ? (
                <span className="adm-confirm">
                  <span>Eliminar {plural(chosen.length, "pedido", "pedidos")} para sempre?</span>
                  <button type="button" className="adm-btn sm" disabled={busy} onClick={() => void removeMany()}>{busy ? "A eliminar…" : "Sim, eliminar"}</button>
                  <button type="button" className="adm-btn ghost sm" disabled={busy} onClick={() => setConfirm(null)}>Não</button>
                </span>
              ) : (
                <button type="button" className="adm-btn ghost danger sm" disabled={busy} onClick={() => setConfirm("bulk")}><Icon name="trash" size={15} />Eliminar</button>
              )}
              <button type="button" className="adm-link" onClick={() => { setSelected(new Set()); setConfirm(null); }}>Limpar seleção</button>
              {confirm === "bulk" && <small>O stock dos pedidos que ainda não foram enviados volta à loja.</small>}
            </div>
          )}

          {visible.length ? (
            <div className="adm-table-wrap">
              <table className="adm-table adm-orders">
                <thead>
                  <tr>
                    <th className="adm-check-cell"><input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Selecionar todos os pedidos visíveis" /></th>
                    {["Pedido", "Cliente", "Total", "Pagamento", "Entrega", "Entregador", "Estado", "Data", "Ações"].map((h) => <th key={h}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {visible.map((o) => {
                    const open = openId === o.id;
                    const next = NEXT_STEP[o.status];
                    return (
                      <Fragment key={o.id}>
                        <tr className={selected.has(o.id) ? "is-selected" : ""}>
                          <td className="adm-check-cell"><input type="checkbox" checked={selected.has(o.id)} onChange={() => toggle(o.id)} aria-label={`Selecionar o pedido ${shortRef(o.id)}`} /></td>
                          <td>
                            <button type="button" className="adm-expand" aria-expanded={open} onClick={() => setOpenId(open ? null : o.id)} title="Ver detalhes do pedido">
                              <Icon name="right" size={14} />{shortRef(o.id)}
                            </button>
                          </td>
                          <td><strong>{o.customer}</strong><small>{o.email || "—"}</small></td>
                          <td>{money(o.total)}</td>
                          <td>{o.paymentMethod || "—"}</td>
                          <td>{o.deliveryMethod || "—"}</td>
                          <td>
                            {canAssign(o.status) ? (
                              <select className={`adm-select ${needsDriver(o) ? "adm-need" : ""}`} value={o.driver?.id ?? ""} disabled={busy} onChange={(e) => void assign(o.id, e.target.value)} aria-label={`Entregador do pedido ${shortRef(o.id)}`}>
                                <option value="">Sem entregador</option>
                                {o.driver && !drivers.some((d) => d.id === o.driver!.id && d.active) && <option value={o.driver.id} disabled>{o.driver.name} (inativo)</option>}
                                {drivers.filter((d) => d.active).map((d) => <option key={d.id} value={d.id}>{d.name}{d.activeOrders ? ` · ${d.activeOrders} em curso` : ""}</option>)}
                              </select>
                            ) : o.driver ? <><strong>{o.driver.name}</strong><small>{fmtPhone(o.driver.phone)}</small></> : "—"}
                          </td>
                          <td>
                            <select className={`adm-select adm-badge-select ${o.status}`} value={o.status} disabled={busy} onChange={(e) => void update(o.id, e.target.value)} aria-label={`Estado do pedido ${shortRef(o.id)}`}>
                              {ORDER_STATES.map((st) => <option key={st} value={st} disabled={o.status === "cancelled" && st !== "cancelled"}>{STATUS_LABELS[st]}</option>)}
                            </select>
                          </td>
                          <td>{date(o.createdAt)}</td>
                          <td>
                            {confirm === o.id ? (
                              <span className="adm-confirm">
                                <span>Eliminar?</span>
                                <button type="button" className="adm-btn sm" disabled={busy} onClick={() => void removeOne(o.id)}>Sim</button>
                                <button type="button" className="adm-btn ghost sm" disabled={busy} onClick={() => setConfirm(null)}>Não</button>
                              </span>
                            ) : (
                              <div className="adm-actions">
                                {next && <button type="button" className="adm-btn sm" disabled={busy} onClick={() => void update(o.id, next.to)}>{next.label}</button>}
                                <button type="button" className="adm-btn ghost danger sm" disabled={busy} onClick={() => setConfirm(o.id)} aria-label={`Eliminar o pedido ${shortRef(o.id)}`} title="Eliminar pedido"><Icon name="trash" size={15} /></button>
                              </div>
                            )}
                          </td>
                        </tr>
                        {open && (
                          <tr className="adm-detail-row">
                            <td colSpan={10}>
                              <div className="adm-detail">
                                <div>
                                  <h3>Artigos</h3>
                                  {o.items?.length ? (
                                    <ul className="adm-items">
                                      {o.items.map((i) => <li key={i.id}><span>{i.name}<small>{i.quantity} × {money(i.unitPrice)}</small></span><strong>{money(i.subtotal)}</strong></li>)}
                                    </ul>
                                  ) : <p className="adm-muted">Sem artigos registados.</p>}
                                  <p className="adm-detail-total"><span>Total</span><strong>{money(o.total)}</strong></p>
                                </div>
                                <dl className="adm-meta">
                                  <div><dt>Cliente</dt><dd>{o.customer}{o.email && <small>{o.email}</small>}</dd></div>
                                  <div><dt>Data</dt><dd>{dateTime(o.createdAt)}</dd></div>
                                  <div><dt>Entrega</dt><dd>{o.deliveryMethod || "—"}</dd></div>
                                  <div><dt>Pagamento</dt><dd>{o.paymentMethod || "—"}</dd></div>
                                  <div><dt>Entregador</dt><dd>{o.driver ? <>{o.driver.name}<small><a href={`tel:${o.driver.phone}`}>{fmtPhone(o.driver.phone)}</a></small></> : "—"}</dd></div>
                                  <div className="wide"><dt>Morada de entrega</dt><dd className="adm-addr">{o.shippingAddress || "—"}</dd></div>
                                  <div className="wide"><dt>Referência</dt><dd className="adm-ref">{o.id}</dd></div>
                                  <div className="wide"><dt>Acompanhamento</dt><dd><OrderTimeline orderId={o.id} refreshKey={timelineKey} /></dd></div>
                                </dl>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : all.length === 0 ? <Empty icon="orders" text="Ainda não existem pedidos." /> : <Empty icon="orders" text="Nenhum pedido corresponde aos filtros." />}
        </section>
      )}
    </>
  );
}

/** Linha do tempo de um pedido: cada mudança de estado e cada atribuição de entregador, com a hora. */
function OrderTimeline({ orderId, refreshKey }: { orderId: string; refreshKey: number }) {
  const [events, setEvents] = useState<OrderEvent[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    adminApi.orderEvents(orderId)
      .then((r) => { if (alive) { setEvents(r.events); setFailed(false); } })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [orderId, refreshKey]);

  if (!events) return <span className="adm-muted">{failed ? "Não foi possível carregar o histórico." : "A carregar…"}</span>;
  if (events.length === 0) return <span className="adm-muted">Sem registos.</span>;
  return (
    <ol className="adm-timeline">
      {events.map((e) => (
        <li key={e.id} className={e.kind}>
          {e.kind === "status" ? <strong>{STATUS_LABELS[e.status ?? ""] ?? e.status}</strong> : <strong>{e.driverName ? `Entregador: ${e.driverName}` : "Entregador retirado"}</strong>}
          <small>{dateTime(e.createdAt)}</small>
        </li>
      ))}
    </ol>
  );
}

/* ========================================================================== */
/* Entregadores                                                               */
/* ========================================================================== */
const fetchDrivers = () => adminApi.drivers().then((r) => r.drivers);
const NEW_DRIVER: Driver = { id: "", name: "", phone: "", vehicle: "", active: true, createdAt: "", activeOrders: 0, totalOrders: 0 };

/**
 * Equipa de entrega. O administrador regista entregadores (nome, telefone, veículo), edita-os,
 * desativa-os (deixam de receber pedidos, mas o histórico fica) e só elimina quem nunca teve pedidos.
 * A atribuição ao pedido faz-se em Pedidos.
 */
function DriversView() {
  const { data: items, error, setError, reload } = useLoad<Driver[]>(fetchDrivers);
  const [editing, setEditing] = useState<Driver | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const toggle = async (d: Driver) => {
    setBusyId(d.id); setError("");
    try { await adminApi.updateDriver(d.id, { active: !d.active }); await reload(); } catch (e) { setError(errorText(e)); } finally { setBusyId(null); }
  };
  const remove = async (d: Driver) => {
    if (!confirm(`Eliminar o entregador "${d.name}"?`)) return;
    setBusyId(d.id); setError("");
    try { await adminApi.deleteDriver(d.id); await reload(); } catch (e) { setError(errorText(e)); } finally { setBusyId(null); }
  };

  const list = items ?? [];
  const delivering = list.reduce((n, d) => n + d.activeOrders, 0);

  return (
    <>
      <PageTitle title="Entregadores" text="Registe a equipa de entrega e atribua-a aos pedidos em Pedidos."
        action={<button className="adm-btn" onClick={() => setEditing(NEW_DRIVER)}><Icon name="plus" size={16} />Novo entregador</button>} />
      {error && <Notice>{error}</Notice>}
      {!items ? (!error && <Loading text="A carregar entregadores…" />) : (
        <section className="adm-card">
          {list.length > 0 && <p className="adm-summary">{plural(list.filter((d) => d.active).length, "entregador ativo", "entregadores ativos")} · {plural(delivering, "entrega em curso", "entregas em curso")}</p>}
          {list.length ? (
            <DataTable
              headers={["Entregador", "Veículo", "Em curso", "Total de entregas", "Estado", "Ações"]}
              rows={list.map((d) => ({
                key: d.id,
                cells: [
                  <span key="n"><strong>{d.name}</strong><small><a href={`tel:${d.phone}`}>{fmtPhone(d.phone)}</a></small></span>,
                  d.vehicle || "—",
                  d.activeOrders,
                  d.totalOrders,
                  <Badge key="s" value={d.active ? "active" : "inactive"} />,
                  <div className="adm-actions" key="a">
                    <button className="adm-btn ghost sm" onClick={() => setEditing(d)} disabled={busyId === d.id}><Icon name="edit" size={15} />Editar</button>
                    <button className="adm-btn ghost sm" onClick={() => void toggle(d)} disabled={busyId === d.id}>{d.active ? "Desativar" : "Ativar"}</button>
                    {d.totalOrders === 0 && <button className="adm-btn ghost danger sm" onClick={() => void remove(d)} disabled={busyId === d.id} aria-label={`Eliminar ${d.name}`}><Icon name="trash" size={15} /></button>}
                  </div>,
                ],
              }))}
            />
          ) : <Empty icon="drivers" text="Ainda não há entregadores. Registe o primeiro." />}
        </section>
      )}
      {editing && <DriverModal driver={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void reload(); }} />}
    </>
  );
}

function DriverModal({ driver, onClose, onSaved }: { driver: Driver; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(driver.name);
  const [phone, setPhone] = useState(driver.phone ? onlyPhoneDigits(driver.phone) : ""); // só os 9 dígitos; o +258 junta-se ao gravar
  const [vehicle, setVehicle] = useState(driver.vehicle);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const body = { name: name.trim(), phone: `+258${phone}`, vehicle: vehicle.trim() };
      if (driver.id) await adminApi.updateDriver(driver.id, body);
      else await adminApi.createDriver(body);
      onSaved();
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  };

  return (
    <div className="adm-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <form className="adm-modal" onSubmit={save} role="dialog" aria-modal="true" aria-labelledby="adm-drv-title">
        <div className="adm-modal-head">
          <h2 id="adm-drv-title">{driver.id ? "Editar entregador" : "Novo entregador"}</h2>
          <button type="button" className="adm-icon-btn" onClick={onClose} disabled={busy} aria-label="Fechar"><Icon name="close" /></button>
        </div>
        <div className="adm-form-grid">
          <label className="wide">Nome completo
            <input type="text" value={name} onChange={(e) => setName(onlyPersonText(e.target.value))} required minLength={2} maxLength={100} autoComplete="name" autoFocus />
          </label>
          <label>Telefone
            <input type="tel" value={phone} onChange={(e) => setPhone(onlyPhoneDigits(e.target.value))} required inputMode="numeric" autoComplete="tel-national" maxLength={9} pattern="8[2-7][0-9]{7}" title="9 dígitos, a começar por 82, 83, 84, 85, 86 ou 87." />
          </label>
          <label>Veículo (opcional)
            <input type="text" value={vehicle} onChange={(e) => setVehicle(onlyLabelText(60)(e.target.value))} maxLength={60} list="adm-vehicles" />
            <datalist id="adm-vehicles"><option value="Mota" /><option value="Bicicleta" /><option value="Carro" /><option value="Carrinha" /><option value="A pé" /></datalist>
          </label>
        </div>
        {error && <Notice>{error}</Notice>}
        <div className="adm-modal-actions">
          <button type="button" className="adm-btn ghost" onClick={onClose} disabled={busy}>Cancelar</button>
          <button className="adm-btn" disabled={busy || name.trim().length < 2 || !/^8[2-7]\d{7}$/.test(phone)}>{busy ? "A guardar…" : driver.id ? "Guardar alterações" : "Registar entregador"}</button>
        </div>
      </form>
    </div>
  );
}
