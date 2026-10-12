/**
 * data.ts — camada de dados do frontend.
 * Guarda os tipos, as categorias, o catálogo de produtos (vazio por agora) e os dados da empresa.
 * Está separado da interface para ser fácil trocar por uma API mais tarde.
 */

/**
 * Modelo de um produto do catálogo.
 * - group: grupo principal (chave de `categories`)
 * - cat: subcategoria dentro desse grupo
 * - price: preço em Meticais (MT)
 * - brand, rating e available são opcionais (`?`), por isso o código que os usa
 *   trata o caso de estarem em falta.
 */
export type Product = {
  id: string; name: string; group: string; cat: string; price: number;
  brand?: string; rating?: number; available?: boolean;
  description?: string; image?: string; stock?: number; active?: boolean;
};
/**
 * Árvore de categorias da loja: { grupo -> lista de subcategorias }.
 * É usada nos filtros, na página de categorias e nas sugestões de pesquisa.
 */
export const categories: Record<string, string[]> = {
  "Acessórios para telemóveis": [
    "Capas",
    "Películas de vidro",
    "Cabos USB-C, Lightning e Micro-USB",
    "Carregadores rápidos",
    "Carregadores veiculares",
    "Suportes para telemóvel",
    "Pop sockets",
    "Adaptadores OTG",
    "Leitores de cartões",
    "Power banks",
    "Suportes magnéticos"
  ],
  "Áudio": [
    "Fones Bluetooth",
    "Fones com fio",
    "Headsets",
    "Colunas Bluetooth",
    "Microfones",
    "Adaptadores de áudio",
    "Cabos AUX"
  ],
  "Computadores": [
    "Ratos",
    "Teclados",
    "Mouse pads",
    "Webcams",
    "Hubs USB",
    "Adaptadores USB",
    "Pendrives",
    "Leitores de cartões",
    "Cabos HDMI",
    "Cabos Ethernet",
    "Suportes para laptop",
    "Bases de refrigeração",
    "Adaptadores Wi-Fi/Bluetooth"
  ],
  "Energia e carregamento": [
    "Extensões elétricas",
    "Filtros de linha",
    "Adaptadores de tomada",
    "Carregadores universais",
    "Carregadores rápidos",
    "Cabos de diferentes comprimentos",
    "UPS para computadores/routers",
    "Mini UPS para router",
    "Lâmpadas LED USB"
  ],
  "Internet e conectividade": [
    "Routers",
    "Repetidores Wi-Fi",
    "Adaptadores Wi-Fi",
    "Adaptadores Bluetooth",
    "Cabos de rede",
    "Switches",
    "Antenas Wi-Fi",
    "Modems/routers 4G"
  ],
  "Acessórios automóveis": [
    "Suportes de telemóvel",
    "Carregadores USB para carro",
    "Transmissores Bluetooth FM",
    "Câmaras veiculares",
    "Cabos para carregamento",
    "Adaptadores USB",
    "Compressores portáteis",
    "Aspiradores portáteis"
  ],
  "Fotografia e vídeo": [
    "Tripés",
    "Ring lights",
    "Suportes para telemóvel",
    "Microfones para smartphone",
    "Luzes LED",
    "Gimbals",
    "Selfie sticks",
    "Cartões de memória",
    "Leitores de cartões"
  ],
  "Gadgets": [
    "Smartwatches",
    "Smart bands",
    "Relógios digitais",
    "Lâmpadas inteligentes",
    "Tomadas inteligentes",
    "Rastreadores Bluetooth",
    "Mini projetores",
    "Power banks"
  ]
};
/**
 * Catálogo de produtos (vazio por agora).
 * Adicione produtos aqui ou, quando existir uma API, carregue-os do servidor,
 * mantendo o mesmo tipo `Product`.
 */
export const products: Product[] = [];

export const setProducts = (rows: Product[]) => {
  products.splice(0, products.length, ...rows);
};
/**
 * Formata um número como preço. Ex.: 2200 -> "2 200 MT" (formato pt-PT).
 */
export const fmt = (n: number) => `${Number(n || 0).toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\u00A0/g, ".").replace(/\s/g, "")} MT`;

// Dados da empresa. Campos vazios ficam ocultos no site (rodapé e página de contacto).
// Preencha com os dados reais da loja quando estiverem disponíveis.
export const company = {
  name: "NhongaExpress",
  phone: "",
  whatsapp: "258875621738", // apenas números, com indicativo. Ex.: 2588XXXXXXXX
  whatsappLabel: "+258 87 562 1738",
  email: "",
  address: "Beira, Sofala",
  hours: "",
  facebook: "",
  instagram: "",
  tiktok: "",
  youtube: "",
};
