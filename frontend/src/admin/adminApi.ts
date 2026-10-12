/**
 * admin/adminApi.ts — cliente HTTP do painel (rotas /api/admin).
 * Usa o MESMO cookie de sessão da loja (`credentials: "include"`): não há token
 * nem login próprio do painel. Se a sessão acabar (401), volta ao login da loja.
 */
import { ADMIN_LOGIN_URL } from "../services/route";

const BASE = import.meta.env.VITE_API_URL ?? "";

export type Admin = { id: string; name: string; email: string | null; phone: string | null; role: "admin" };
/** Especificação do produto: uma linha "característica → valor" (ex.: "Bateria" → "30 horas"). */
export type ProductSpec = { label: string; value: string };
/** Máximo de especificações por produto. */
export const MAX_PRODUCT_SPECS = 20;
/** `image` é a foto principal (a que aparece nos cartões); `images` são as fotos extra da galeria, por ordem; `specs` são as especificações, por ordem. */
export type Product = { id: string; name: string; description: string; price: number; category: string; image: string; images?: string[]; specs?: ProductSpec[]; stock: number; active: boolean; createdAt: string; updatedAt: string };
/** Máximo de fotos por produto (principal + extras). */
export const MAX_PRODUCT_PHOTOS = 6;
export type ProductInput = Omit<Product, "id" | "createdAt" | "updatedAt">;
/** Categoria da loja. `icon` é gerado automaticamente a partir do nome (não é editado no painel); `productCount` = produtos que a usam. */
export type Category = { id: string; name: string; icon: string; position: number; productCount: number };
export type CategoryInput = { name: string; icon?: string };
export type Customer = { id: string; name: string; email: string | null; phone: string | null; createdAt: string };
export type OrderItem = { id: string; name: string; quantity: number; unitPrice: number; subtotal: number };
/** Entregador atribuído a um pedido (nome e telefone, para o painel mostrar sem outra chamada). */
export type OrderDriver = { id: string; name: string; phone: string };
export type Order = { id: string; userId: string | null; customer: string; email: string; total: number; status: string; paymentMethod?: string; shippingAddress?: string; deliveryMethod?: string; driver?: OrderDriver | null; driverAssignedAt?: string | null; createdAt: string; items?: OrderItem[] };
/** Entregador. `activeOrders` = entregas em curso; `totalOrders` = todas as que já lhe foram atribuídas (se for 0, pode ser eliminado). */
export type Driver = { id: string; name: string; phone: string; vehicle: string; active: boolean; createdAt: string; activeOrders: number; totalOrders: number };
export type DriverInput = { name: string; phone: string; vehicle?: string; active?: boolean };
/** Linha do tempo do pedido: mudança de estado (`status`) ou atribuição/retirada de entregador (`driver`). */
export type OrderEvent = { id: string; kind: "status" | "driver"; status: string | null; driverName: string | null; createdAt: string };
export type Dashboard = { stats: { customers: number; products: number; orders: number; revenue: number }; recentOrders: Order[] };

/** Secções da página inicial (rotas /api/admin/home-sections). Mesma ordem e nomes do backend (utils/homeSections.ts). */
export type HomeSectionSlug = "featured" | "offers" | "new" | "best-sellers" | "recommended";
export type HomeSection = { slug: HomeSectionSlug; title: string; limit: number; products: Product[] };
export const HOME_SECTION_META: { slug: HomeSectionSlug; title: string; limit: number }[] = [
  { slug: "featured", title: "Produto em destaque", limit: 1 },
  { slug: "offers", title: "Ofertas e promoções", limit: 12 },
  { slug: "new", title: "Novidades", limit: 12 },
  { slug: "best-sellers", title: "Mais vendidos", limit: 12 },
  { slug: "recommended", title: "Recomendados para si", limit: 12 },
];

/** Bairro da Beira e a sua taxa de entrega fixa em MT (null = ainda não definida). */
export type DeliveryZone = { neighborhood: string; feeMzn: number | null };

export class AdminApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

type Init = { method?: string; json?: unknown; file?: File };

async function request<T>(path: string, { method = "GET", json, file }: Init = {}): Promise<T> {
  const headers: Record<string, string> = {};
  let body: BodyInit | undefined;
  if (json !== undefined) { headers["Content-Type"] = "application/json"; body = JSON.stringify(json); }
  if (file) { headers["Content-Type"] = file.type; body = file; }

  let res: Response;
  try {
    res = await fetch(`${BASE}/api/admin${path}`, { method, headers, body, credentials: "include" });
  } catch {
    throw new AdminApiError(0, "Não foi possível ligar ao servidor. Verifique a ligação e tente novamente.");
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Sessão terminada a meio do trabalho: volta ao login da loja (que devolve ao painel depois).
    if (res.status === 401) window.location.replace(ADMIN_LOGIN_URL);
    throw new AdminApiError(res.status, data.message ?? "Ocorreu um erro. Tente novamente.");
  }
  return data as T;
}

export const adminApi = {
  me: () => request<{ admin: Admin }>("/me"),
  /** Bairros da Beira com a taxa de entrega fixa em MT (null = ainda não definida). */
  deliveryZones: () => fetch(`${BASE}/api/delivery/zones/admin`, { credentials: "include" }).then(async r => { const d = await r.json(); if (!r.ok) throw new AdminApiError(r.status, d.message ?? "Erro"); return d as { zones: DeliveryZone[] }; }),
  saveDeliveryZone: (neighborhood: string, body: { feeMzn: number }) => fetch(`${BASE}/api/delivery/zones/${encodeURIComponent(neighborhood)}`, { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(async r => { const d = await r.json(); if (!r.ok) throw new AdminApiError(r.status, d.message ?? "Erro"); return d; }),
  publishDeliveryLocation: (orderId: string, body: { latitude: number; longitude: number; heading?: number; speed?: number }) => fetch(`${BASE}/api/delivery/orders/${encodeURIComponent(orderId)}/location`, { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(async r => { const d = await r.json(); if (!r.ok) throw new AdminApiError(r.status, d.message ?? "Erro"); return d; }),
  dashboard: () => request<Dashboard>("/dashboard"),
  products: () => request<{ products: Product[] }>("/products"),
  createProduct: (body: ProductInput) => request<{ product: Product }>("/products", { method: "POST", json: body }),
  updateProduct: (id: string, body: Partial<ProductInput>) => request<{ product: Product }>(`/products/${id}`, { method: "PATCH", json: body }),
  deleteProduct: (id: string) => request<void>(`/products/${id}`, { method: "DELETE" }),
  categories: () => request<{ categories: Category[] }>("/categories"),
  createCategory: (body: CategoryInput) => request<{ category: Category }>("/categories", { method: "POST", json: body }),
  updateCategory: (id: string, body: Partial<CategoryInput>) => request<{ category: Category }>(`/categories/${id}`, { method: "PATCH", json: body }),
  deleteCategory: (id: string) => request<void>(`/categories/${id}`, { method: "DELETE" }),
  customers: () => request<{ customers: Customer[] }>("/customers"),
  orders: () => request<{ orders: Order[] }>("/orders"),
  updateOrderStatus: (id: string, status: string) => request<{ order: Order }>(`/orders/${id}/status`, { method: "PATCH", json: { status } }),
  deleteOrder: (id: string) => request<void>(`/orders/${id}`, { method: "DELETE" }),
  /** Entregadores: registo, edição, ativar/desativar e eliminar (só quem nunca teve pedidos). */
  drivers: () => request<{ drivers: Driver[] }>("/drivers"),
  createDriver: (body: DriverInput) => request<{ driver: Driver }>("/drivers", { method: "POST", json: body }),
  updateDriver: (id: string, body: Partial<DriverInput>) => request<{ driver: Driver }>(`/drivers/${id}`, { method: "PATCH", json: body }),
  deleteDriver: (id: string) => request<void>(`/drivers/${id}`, { method: "DELETE" }),
  /** Atribui o entregador ao pedido (`null` retira-o). */
  assignDriver: (orderId: string, driverId: string | null) => request<{ order: { id: string; driver: OrderDriver | null; driverAssignedAt: string | null } }>(`/orders/${orderId}/driver`, { method: "PUT", json: { driverId } }),
  orderEvents: (orderId: string) => request<{ events: OrderEvent[] }>(`/orders/${orderId}/events`),
  /** Ações em massa: devolvem só os pedidos que realmente mudaram / foram eliminados. */
  bulkOrderStatus: (ids: string[], status: string) => request<{ updated: Pick<Order, "id" | "total" | "status" | "createdAt">[]; skipped: number }>("/orders/bulk-status", { method: "POST", json: { ids, status } }),
  bulkDeleteOrders: (ids: string[]) => request<{ deleted: string[] }>("/orders/bulk-delete", { method: "POST", json: { ids } }),
};

/** Secções da página inicial: produto em destaque, ofertas, novidades, mais vendidos, recomendados. */
export const homeApi = {
  sections: () => request<{ sections: HomeSection[] }>("/home-sections"),
  setSection: (slug: HomeSectionSlug, productIds: string[]) => request<{ section: HomeSection }>(`/home-sections/${slug}/products`, { method: "PUT", json: { productIds } }),
  addToSection: (slug: HomeSectionSlug, productId: string) => request<{ section: HomeSection }>(`/home-sections/${slug}/products`, { method: "POST", json: { productId } }),
  removeFromSection: (slug: HomeSectionSlug, productId: string) => request<void>(`/home-sections/${slug}/products/${productId}`, { method: "DELETE" }),
  productSections: (id: string) => request<{ sections: HomeSectionSlug[] }>(`/products/${id}/home-sections`),
  setProductSections: (id: string, sections: HomeSectionSlug[]) => request<{ sections: HomeSectionSlug[] }>(`/products/${id}/home-sections`, { method: "PUT", json: { sections } }),
};

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];

/** Limites da otimização: lado maior da foto, qualidade e tamanho máximo do original e do resultado. */
const MAX_SIDE = 1200;          // px (chega para a página de detalhe e fica leve nos cartões)
const QUALITY = 0.8;            // WebP/JPEG 80% — quase sem perda visível
const MAX_ORIGINAL = 25 * 1024 * 1024; // fotos de telemóvel grandes são aceites, porque são reduzidas aqui
const MAX_UPLOAD = 2 * 1024 * 1024;    // o que realmente é enviado ao servidor

/** Lê a imagem respeitando a rotação EXIF (fotos de telemóvel tiradas na vertical). */
async function decodeImage(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
    } catch { /* tenta o método clássico abaixo */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
  } catch {
    URL.revokeObjectURL(url);
    throw new Error("Não foi possível ler esta imagem. Tente outra foto.");
  }
}

const toBlob = (canvas: HTMLCanvasElement, type: string) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, QUALITY));

export type OptimizeOptions = {
  /** Remove o fundo automaticamente (corre no navegador, sem enviar a foto a terceiros). */
  removeBg?: boolean;
  /** Progresso 0–1 da remoção do fundo (descarga do modelo + processamento). */
  onProgress?: (fraction: number) => void;
};

/** Recorta o produto e deixa o fundo transparente. O modelo é carregado só quando é preciso (1.ª vez demora mais). */
async function cutOutBackground(png: Blob, onProgress?: (f: number) => void): Promise<Blob> {
  const { removeBackground } = await import("@imgly/background-removal");
  return removeBackground(png, {
    output: { format: "image/png" },
    progress: (_key: string, current: number, total: number) => { if (total > 0) onProgress?.(Math.min(1, current / total)); },
  });
}

/**
 * Prepara a foto no navegador ANTES de a enviar: reduz para no máximo 1200 px no lado maior e
 * converte para WebP (80%). Uma foto de telemóvel de vários MB fica com poucas centenas de KB,
 * o que poupa espaço no servidor e torna a loja muito mais rápida. Se a foto original já for
 * pequena e leve, é mantida como está. Com `removeBg`, o fundo é removido antes de converter
 * (o WebP/PNG guardam a transparência).
 */
export async function optimizeProductImage(file: File, opts: OptimizeOptions = {}): Promise<File> {
  if (!IMAGE_TYPES.includes(file.type)) throw new Error("Use uma imagem JPG, PNG, WebP ou AVIF.");
  if (file.size > MAX_ORIGINAL) throw new Error("A imagem é demasiado grande (máximo 25 MB).");

  const img = await decodeImage(file);
  try {
    const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("O navegador não conseguiu preparar a imagem.");
    // Sem fundo branco: o WebP guarda a transparência, por isso PNG/WebP sem fundo ficam sem fundo.
    ctx.drawImage(img.source, 0, 0, w, h);

    // Remover fundo: faz-se depois de reduzir a foto (mais rápido) e antes de converter para WebP.
    // Se falhar, mostra um aviso claro (o administrador pode desligar a opção e tentar de novo).
    let cutOut = false;
    if (opts.removeBg) {
      try {
        const png = await toBlob(canvas, "image/png");
        if (!png) throw new Error("png");
        const result = await cutOutBackground(png, opts.onProgress);
        const bmp = await createImageBitmap(result);
        try {
          ctx.clearRect(0, 0, w, h);
          ctx.drawImage(bmp, 0, 0, w, h);
          // Verificação: se quase nada ficou visível, o recorte apagou o produto — não se aceita.
          const px = ctx.getImageData(0, 0, w, h).data;
          let visible = 0;
          for (let i = 3; i < px.length; i += 4) if (px[i] > 20) visible++;
          if (visible / (w * h) < 0.04) throw new Error("recorte-vazio");
          cutOut = true;
        } finally {
          bmp.close();
        }
      } catch (err) {
        console.error("[remover-fundo]", err);
        const raw = err instanceof Error ? err.message : String(err);
        const reason = raw === "recorte-vazio" ? "o recorte apagou o produto" : raw.replace(/\s+/g, " ").slice(0, 160) || "erro desconhecido";
        throw new Error(`Não foi possível remover o fundo desta foto (${reason}). Foi mantida com o fundo original.`);
      }
    }

    // WebP; se o navegador não o codificar (devolve PNG/null), usa JPEG.
    let blob = await toBlob(canvas, "image/webp");
    if (cutOut && (!blob || blob.type !== "image/webp")) {
      // Sem fundo: PNG guarda a transparência (JPEG não guardaria).
      blob = await toBlob(canvas, "image/png");
    } else if (!blob || blob.type !== "image/webp") {
      // JPEG não tem transparência (ficaria preto): só neste caso pinta-se o fundo de branco por baixo.
      ctx.globalCompositeOperation = "destination-over";
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = "source-over";
      blob = await toBlob(canvas, "image/jpeg");
    }
    if (!blob) throw new Error("Não foi possível otimizar a imagem.");

    // Já era pequena e leve: não vale a pena trocar.
    if (!cutOut && scale === 1 && blob.size >= file.size && file.size <= MAX_UPLOAD) return file;

    const ext = blob.type === "image/webp" ? "webp" : blob.type === "image/png" ? "png" : "jpg";
    const base = file.name.replace(/\.[^.]+$/, "") || "produto";
    return new File([blob], `${base}.${ext}`, { type: blob.type });
  } finally {
    img.close();
  }
}

/** Envia a foto do produto para o backend e devolve o URL público (é o que se guarda no produto). */
export async function uploadProductImage(file: File): Promise<string> {
  if (!IMAGE_TYPES.includes(file.type)) throw new Error("Use uma imagem JPG, PNG, WebP ou AVIF.");
  if (file.size > MAX_UPLOAD) throw new Error("A imagem continua grande demais mesmo depois de otimizada (máximo 2 MB). Tente outra foto.");
  const { url } = await request<{ url: string }>("/uploads", { method: "POST", file });
  return url;
}

/** Termina a sessão (a mesma da loja) e volta à loja. */
export async function logoutAndLeave(to: string): Promise<void> {
  try {
    await fetch(`${BASE}/api/auth/logout`, { method: "POST", credentials: "include" });
  } finally {
    window.location.assign(to);
  }
}
