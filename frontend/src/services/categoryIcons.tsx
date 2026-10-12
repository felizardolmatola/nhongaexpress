/**
 * services/categoryIcons.tsx — ícones das categorias, GERADOS A PARTIR DO NOME.
 *
 * - ICON_LIBRARY: biblioteca de ícones SVG (traço, 24x24) com palavras-chave em português.
 * - suggestIconKeys("Fotografia e vídeo") -> ["camera", ...]: o painel usa isto enquanto o
 *   administrador escreve o nome da categoria; a loja usa-o quando uma categoria não tem ícone guardado.
 * - CategoryIcon: desenha o ícone (mesmo tamanho, traço e estilo em todo o lado).
 * O que se guarda na base de dados é só a CHAVE do ícone (ex.: "camera"), nunca o desenho.
 */
import type { ReactElement } from "react";

export type IconDef = { label: string; keywords: string[]; svg: ReactElement };

export const ICON_LIBRARY: Record<string, IconDef> = {
  phone: { label: "Telemóvel", keywords: ["telemovel", "telemoveis", "telefone", "celular", "smartphone", "iphone", "android", "mobile"], svg: (<><rect x="5" y="2" width="14" height="20" rx="2" /><path d="M9 5h6M11 18h2" /></>) },
  headphones: { label: "Áudio", keywords: ["audio", "som", "auscultador", "auscultadores", "fone", "fones", "headphone", "ouvido", "ouvidos"], svg: (<><path d="M3 14v-2a9 9 0 0 1 18 0v2" /><path d="M21 15a2 2 0 0 1-2 2h-1v-6h1a2 2 0 0 1 2 2z" /><path d="M3 15a2 2 0 0 0 2 2h1v-6H5a2 2 0 0 0-2 2z" /></>) },
  monitor: { label: "Computador", keywords: ["computador", "computadores", "desktop", "monitor", "monitores", "pc", "ecra"], svg: (<><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" /></>) },
  laptop: { label: "Portátil", keywords: ["portatil", "portateis", "laptop", "notebook", "macbook"], svg: (<><rect x="4" y="5" width="16" height="11" rx="1.5" /><path d="M2 20h20" /></>) },
  tablet: { label: "Tablet", keywords: ["tablet", "tablets", "ipad", "leitor"], svg: (<><rect x="4" y="2" width="16" height="20" rx="2" /><path d="M12 18h.01" /></>) },
  zap: { label: "Energia", keywords: ["energia", "carregamento", "carregador", "carregadores", "eletrico", "eletricidade", "electrico", "power", "raio"], svg: <path d="M13 2 3 14h9l-1 8 10-12h-9z" /> },
  battery: { label: "Bateria", keywords: ["bateria", "baterias", "pilha", "pilhas", "powerbank"], svg: (<><rect x="2" y="7" width="16" height="10" rx="2" /><path d="M22 11v2M6 11v2" /></>) },
  plug: { label: "Cabos e tomadas", keywords: ["cabo", "cabos", "tomada", "tomadas", "adaptador", "adaptadores", "ficha", "extensao"], svg: <path d="M12 22v-5M9 8V2M15 8V2M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8z" /> },
  sun: { label: "Solar", keywords: ["solar", "solares", "painel", "paineis", "fotovoltaico", "sol"], svg: (<><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>) },
  wifi: { label: "Internet", keywords: ["internet", "conectividade", "rede", "redes", "router", "wifi", "modem"], svg: (<><path d="M5 12.5a11 11 0 0 1 14 0" /><path d="M1.4 9a16 16 0 0 1 21.2 0" /><path d="M8.5 16.1a6 6 0 0 1 7 0" /><path d="M12 20h.01" /></>) },
  car: { label: "Automóvel", keywords: ["automovel", "automoveis", "carro", "carros", "auto", "veiculo", "veiculos", "viatura"], svg: (<><path d="M3 13l2-6a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1l2 6v5H3z" /><path d="M3 13h18" /><circle cx="7.5" cy="16" r="1" /><circle cx="16.5" cy="16" r="1" /></>) },
  camera: { label: "Fotografia", keywords: ["fotografia", "foto", "fotos", "video", "videos", "camara", "camera", "filmagem"], svg: (<><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></>) },
  watch: { label: "Gadgets", keywords: ["gadget", "gadgets", "relogio", "relogios", "smartwatch", "wearable"], svg: (<><circle cx="12" cy="12" r="6" /><path d="M12 9v3l1.5 1.5M16.5 17.5 16 22H8l-.5-4.5M7.5 6.5 8 2h8l.5 4.5" /></>) },
  gamepad: { label: "Jogos", keywords: ["jogo", "jogos", "gaming", "game", "consola", "consolas", "videojogo", "videojogos", "playstation", "xbox"], svg: (<><path d="M6 11h4M8 9v4M15 12h.01M18 10h.01" /><path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258A4 4 0 0 0 17.32 5z" /></>) },
  tv: { label: "Televisão", keywords: ["televisao", "televisoes", "televisor", "tv", "tvs"], svg: (<><rect x="2" y="7" width="20" height="15" rx="2" /><path d="m17 2-5 5-5-5" /></>) },
  speaker: { label: "Colunas", keywords: ["coluna", "colunas", "altifalante", "altifalantes", "soundbox"], svg: (<><rect x="4" y="2" width="16" height="20" rx="2" /><circle cx="12" cy="14" r="4" /><path d="M12 6h.01" /></>) },
  keyboard: { label: "Teclados", keywords: ["teclado", "teclados", "periferico", "perifericos"], svg: (<><rect x="2" y="6" width="20" height="12" rx="2" /><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8" /></>) },
  mouse: { label: "Ratos", keywords: ["rato", "ratos", "mouse"], svg: (<><rect x="6" y="2" width="12" height="20" rx="6" /><path d="M12 6v4" /></>) },
  printer: { label: "Impressoras", keywords: ["impressora", "impressoras", "impressao", "toner", "escritorio"], svg: (<><path d="M6 9V2h12v7" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></>) },
  drive: { label: "Armazenamento", keywords: ["armazenamento", "disco", "discos", "pen", "memoria", "memorias", "ssd", "hdd", "usb"], svg: (<><path d="M22 12H2" /><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" /><path d="M6 16h.01M10 16h.01" /></>) },
  bulb: { label: "Iluminação", keywords: ["iluminacao", "luz", "luzes", "lampada", "lampadas", "led"], svg: <path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.2 1 2V18h6v-1.3c0-.8.4-1.5 1-2A7 7 0 0 0 12 2z" /> },
  shield: { label: "Segurança", keywords: ["seguranca", "protecao", "alarme", "alarmes", "vigilancia", "cctv"], svg: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /> },
  shirt: { label: "Roupa", keywords: ["roupa", "roupas", "vestuario", "moda", "camisa", "camisola", "camisolas", "textil", "texteis"], svg: <path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z" /> },
  bag: { label: "Malas e bolsas", keywords: ["mala", "malas", "mochila", "mochilas", "bolsa", "bolsas", "saco", "sacos", "compras", "loja"], svg: (<><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" /></>) },
  gem: { label: "Joias", keywords: ["joia", "joias", "joalharia", "bijuteria", "bijuterias"], svg: (<><path d="M6 3h12l4 6-10 12L2 9z" /><path d="M11 3 8 9l4 12 4-12-3-6" /><path d="M2 9h20" /></>) },
  home: { label: "Casa", keywords: ["casa", "lar", "decoracao", "domestico", "domesticos", "imovel"], svg: <path d="M3 10.5 12 3l9 7.5M5 9v11h14V9M9 20v-6h6v6" /> },
  bed: { label: "Quarto", keywords: ["cama", "camas", "colchao", "colchoes", "quarto", "dormir", "mobilia", "mobiliario"], svg: <path d="M2 4v16M2 8h18a2 2 0 0 1 2 2v10M2 17h20M6 8v9" /> },
  utensils: { label: "Cozinha", keywords: ["cozinha", "comida", "alimento", "alimentos", "alimentacao", "restaurante", "refeicao", "utensilio", "utensilios"], svg: <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2M7 2v20M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7" /> },
  coffee: { label: "Café e bebidas", keywords: ["cafe", "cha", "bebida", "bebidas", "padaria"], svg: <path d="M17 8h1a4 4 0 1 1 0 8h-1M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4zM6 2v2M10 2v2M14 2v2" /> },
  book: { label: "Livros", keywords: ["livro", "livros", "papelaria", "educacao", "escola", "estudo", "escolar"], svg: (<><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></>) },
  dumbbell: { label: "Desporto", keywords: ["desporto", "desportos", "fitness", "ginasio", "treino", "musculacao"], svg: <path d="M6.5 6.5v11M17.5 6.5v11M3 9v6M21 9v6M6.5 12h11" /> },
  bike: { label: "Bicicletas", keywords: ["bicicleta", "bicicletas", "ciclismo", "bike"], svg: (<><circle cx="5.5" cy="17.5" r="3.5" /><circle cx="18.5" cy="17.5" r="3.5" /><path d="M15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM12 17.5V14l-3-3 4-3 2 3h2" /></>) },
  heart: { label: "Saúde", keywords: ["saude", "bemestar", "farmacia", "cuidados", "cuidado"], svg: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21.2l7.8-7.7 1-1.1a5.5 5.5 0 0 0 0-7.8z" /> },
  sparkles: { label: "Beleza", keywords: ["beleza", "cosmetico", "cosmeticos", "perfume", "perfumes", "maquilhagem", "limpeza"], svg: (<><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" /><path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z" /></>) },
  wrench: { label: "Ferramentas", keywords: ["ferramenta", "ferramentas", "bricolage", "manutencao", "oficina", "construcao"], svg: <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" /> },
  leaf: { label: "Jardim", keywords: ["jardim", "jardinagem", "planta", "plantas", "natureza", "agricultura"], svg: (<><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z" /><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" /></>) },
  paw: { label: "Animais", keywords: ["animal", "animais", "pet", "pets", "cao", "caes", "gato", "gatos"], svg: (<><circle cx="6" cy="10" r="1.6" /><circle cx="10" cy="5.5" r="1.6" /><circle cx="14" cy="5.5" r="1.6" /><circle cx="18" cy="10" r="1.6" /><path d="M12 11c-3 0-5.5 3-5.5 5.5 0 1.6 1.3 2.5 2.7 2.5 1 0 1.8-.5 2.8-.5s1.8.5 2.8.5c1.4 0 2.7-.9 2.7-2.5C17.5 14 15 11 12 11z" /></>) },
  music: { label: "Música", keywords: ["musica", "instrumento", "instrumentos", "guitarra", "piano"], svg: (<><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></>) },
  gift: { label: "Presentes", keywords: ["presente", "presentes", "brinde", "brindes", "oferta", "ofertas", "promocao", "promocoes"], svg: (<><rect x="3" y="8" width="18" height="4" rx="1" /><path d="M12 8v13M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5" /></>) },
  box: { label: "Caixa", keywords: ["embalagem", "embalagens", "caixa", "caixas", "encomenda", "armazem", "outros", "diversos", "geral"], svg: <path d="M21 8l-9-5-9 5v8l9 5 9-5V8zM3.3 7.5 12 12.5l8.7-5M12 22V12.5" /> },
  tag: { label: "Etiqueta", keywords: ["etiqueta", "etiquetas", "preco", "precos", "desconto", "descontos"], svg: (<><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z" /><path d="M7 7h.01" /></>) },
  grid: { label: "Todas", keywords: ["todas", "todos", "tudo", "categorias"], svg: (<><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>) },
};

export const ICON_KEYS = Object.keys(ICON_LIBRARY);

/** Minúsculas e sem acentos: "Acessórios automóveis" -> "acessorios automoveis". */
const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const words = (s: string) => norm(s).split(/[^a-z0-9]+/).filter(Boolean);
/** Raiz simples para ignorar o plural: "computadores" e "computador" ficam iguais. */
const stem = (w: string) => (w.length > 4 ? w.replace(/(es|s)$/, "") : w);

/**
 * Sugere ícones para um nome de categoria, do mais provável para o menos provável.
 * Compara cada palavra do nome com as palavras-chave de cada ícone. Se nada coincidir,
 * devolve ícones neutros (etiqueta, caixa, grelha) — o administrador pode sempre escolher outro.
 */
export function suggestIconKeys(name: string, max = 8): string[] {
  const ws = words(name);
  const joined = norm(name);
  const scored = Object.entries(ICON_LIBRARY)
    .map(([key, def], order) => {
      let score = 0;
      for (const kw of def.keywords) {
        for (const w of ws) {
          if (w === kw || stem(w) === stem(kw)) score += 3;
          else if (kw.length >= 4 && w.length >= 4 && (w.startsWith(kw) || kw.startsWith(w))) score += 2;
        }
        if (kw.length >= 5 && joined.includes(kw) && !ws.includes(kw)) score += 1;
      }
      return { key, score, order };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.order - b.order);
  const keys = scored.map((x) => x.key);
  for (const neutral of ["tag", "box", "grid"]) if (!keys.includes(neutral)) keys.push(neutral);
  return keys.slice(0, max);
}

/** O ícone mais provável para o nome. */
export const suggestIconKey = (name: string): string => suggestIconKeys(name, 1)[0];

/* Ícones guardados pelo administrador (nome da categoria -> chave), preenchido quando a loja carrega /api/categories. */
let storedIcons: Record<string, string> = {};
export const setCategoryIcons = (map: Record<string, string>) => { storedIcons = map; };
/** Chave guardada para a categoria (ou null se não houver / já não existir na biblioteca). */
export const storedIconKey = (name: string): string | null => (storedIcons[name] && ICON_LIBRARY[storedIcons[name]] ? storedIcons[name] : null);

/** Desenha o ícone: usa a chave dada; se não houver, gera-o a partir do nome. */
export function CategoryIcon({ iconKey, name = "", size = 28, strokeWidth = 1.8 }: { iconKey?: string | null; name?: string; size?: number; strokeWidth?: number }) {
  const key = iconKey && ICON_LIBRARY[iconKey] ? iconKey : suggestIconKey(name);
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {ICON_LIBRARY[key].svg}
    </svg>
  );
}
