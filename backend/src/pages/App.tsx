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

import { useEffect, useRef, useState, type ChangeEvent, type CSSProperties, type FormEvent, type InputHTMLAttributes, type ReactNode } from "react";
import "../css/styles.css";
import { api, ApiError, type ApiUser, type CartCheck } from "../services/api";
import { socialLogin, preloadSocial, SocialCancelled, type SocialProvider } from "../services/social";
import fone1 from "../assets/fone-1.jpg";
import fone2 from "../assets/fone-2.jpg";
import { Product, products, categories, setProducts, fmt, company } from "../services/data";
import { PAY_ICONS, MpesaIcon, EmolaIcon } from "./PaymentIcons";
import { ADMIN_BASE, clearNextParam, wantsAdmin } from "../services/route";

/* ========================================================================== */
/* 1. RODAPÉ                                                                  */
/* ========================================================================== */

/**
 * Ícone SVG genérico: recebe os traços (<path/>) como `children` e aplica tamanho e estilo comuns.
 */
const Ico = ({ children, size = 18 }: { children: ReactNode; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);

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
const trust: { t: string; d: string; icon: ReactNode }[] = [
  { t: "Entrega rápida", d: "Expresso em 24 h", icon: <path d="M5 14.5a2.75 2.75 0 1 0 0 5.5 2.75 2.75 0 0 0 0-5.5zM19 14.5a2.75 2.75 0 1 0 0 5.5 2.75 2.75 0 0 0 0-5.5zM7 12h5l2.5 2.5h-6.5M8.5 14.5v3h5.5v-3M17 14.5l-1.5-5h2.5M5 17.25H8" /> },
  { t: "Compra segura", d: "Pague como preferir", icon: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-4" /></> },
  { t: "Apoio ao cliente", d: company.hours || "Fale connosco", icon: <><path d="M3 14v-2a9 9 0 0 1 18 0v2" /><path d="M21 15a2 2 0 0 1-2 2h-1v-6h1a2 2 0 0 1 2 2z" /><path d="M3 15a2 2 0 0 0 2 2h1v-6H5a2 2 0 0 0-2 2z" /></> },
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
    { title: "Produtos", links: [["Produtos", () => go("home")], ["Categorias", () => go("categories")], ["Ofertas", () => info("Ofertas")], ["Novidades", () => info("Novidades")]] },
    { title: "Ajuda", links: [["Contacto", () => info("Contacto")], ["Entregas", () => info("Entregas")], ["Trocas e devoluções", () => info("Trocas e devoluções")], ["FAQ", () => info("FAQ")], ["Sobre nós", about]] },
    { title: "Conta", links: [["Minha conta", () => go("account")], ["Meus pedidos", () => info("Meus pedidos")], ["Lista de desejos", () => go("wishlist")]] },
  ];

  return (
    <footer>
      <div className="ft-wrap">
        {/* Faixa de selos de confiança. */}
        <div className="ft-trust">
          {trust.map((x) => (
            <div key={x.t}><Ico size={30}>{x.icon}</Ico><span><strong>{x.t}</strong><small>{x.d}</small></span></div>
          ))}
        </div>

        {/* Newsletter: mostra confirmação após subscrever ou erro se o e-mail for inválido. */}
        <div className="ft-news">
          <div><h4>Receba ofertas em primeira mão</h4><small>Subscreva a newsletter e não perca promoções e novidades.</small></div>
          {done ? <p className="ft-ok" role="status">✓ Subscrição registada. Obrigado!</p> : (
            <div className="ft-sub">
              <input type="email" maxLength={254} value={mail} aria-label="E-mail para newsletter" aria-invalid={bad}
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
          <div><h4>Formas de pagamento</h4><div className="pills"><span className="pay-chip"><MpesaIcon height={48} /></span><span className="pay-chip"><EmolaIcon height={48} /></span><span className="pay-chip"></span></div></div>
          <div><h4>Entrega</h4><div className="pills"><span>Normal • 1–2 dias</span><span>Expresso • 1h</span></div></div>
        </div>

        {/* Linha final: direitos de autor, links legais e botão "Topo" com scroll suave. */}
        <div className="ft-bottom">
          <p>© 2026 NhongaExpress. Todos os direitos reservados.</p>
          <div className="ft-legal">
            <button onClick={() => info("Termos de uso")}>Termos de uso</button>
            <button onClick={() => info("Política de privacidade")}>Privacidade</button>
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
/**
 * Contrato do estado partilhado. O App cria este objeto e entrega-o a cada página (prop `s`),
 * para que todas leiam o carrinho/favoritos e chamem as mesmas ações (add, toggle, go...).
 */
type Store = {
  q: string; setQ: (v: string) => void; cart: Record<string, number>; wish: string[]; user: boolean;
  /** Dados da conta autenticada (null se não houver sessão ou se o login foi o social simulado). */
  profile: ApiUser | null; setProfile: (u: ApiUser | null) => void;
  add: (id: string, d?: number) => void; toggle: (id: string) => void;
  go: (p: Page) => void; setUser: (v: boolean) => void;
  info: string; setInfo: (t: string) => void;
  selectedProductId: string | null; openProduct: (id: string) => void;
  showToast: (message: string) => void;
  /** Secção da área de conta a mostrar (muda quando o utilizador escolhe uma opção no sino do cabeçalho). */
  accountTarget: { sec: string };
  /** Abre a área de conta já posicionada numa secção (ex.: "Moradas"). */
  openAccount: (sec: string) => void;
};
/**
 * Procura um produto pelo id. O `!` afirma ao TypeScript que o id existe sempre no catálogo.
 */
const byId = (id: string) => products.find((p) => p.id === id)!;
/**
 * Total do carrinho: soma preço × quantidade de cada linha.
 */
const cartTotal = (cart: Record<string, number>) =>
  Object.entries(cart).reduce((t, [id, q]) => { const p = byId(id); return t + (p?.price ?? 0) * q; }, 0);

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
      {/* Área visual reservada para a imagem do produto. */}
      <div className="product-media">
        <div className="product-placeholder" aria-hidden="true">
          {p.image ? <img src={p.image} alt="" /> : <span>{p.name.charAt(0).toUpperCase()}</span>}
        </div>

        {/* Ação de favorito posicionada sobre a imagem. */}
        <button
          type="button"
          className={"product-favorite" + (favorite ? " on" : "")}
          aria-label={favorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
          aria-pressed={favorite}
          title={favorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
          onClick={(e) => { e.stopPropagation(); s.toggle(p.id); s.showToast(favorite ? "Removido dos favoritos" : "✓ Adicionado aos favoritos"); }}
        >
          <FavoriteIcon active={favorite} />
        </button>
      </div>

      {/* Conteúdo textual do produto. */}
      <div className="product-content">
        <p className="product-category">{p.group}</p>
        <h4 className="product-name">{p.name}</h4>
        <p className="product-subcategory">{p.cat}</p>

        {/* Preço destacado para facilitar a leitura. */}
        <div className="product-price">
          <strong>{fmt(p.price)}</strong>
        </div>

        {/* Ação principal de compra. */}
        <button
          type="button"
          className="btn product-add"
          onClick={(e) => { e.stopPropagation(); s.add(p.id); s.showToast("✓ Produto adicionado ao carrinho"); }}
        >
          Adicionar ao carrinho
        </button>
      </div>
    </article>
  );
};
/**
 * Grelha de cartões de produto; se a lista estiver vazia mostra uma mensagem em vez de ficar em branco.
 */
const Grid = ({ list, s }: { list: Product[]; s: Store }) =>
  list.length ? <div className="grid">{list.map((p) => <Card key={p.id} p={p} s={s} />)}</div> : <p className="muted">Nada por aqui ainda.</p>;

/**
 * Logótipos usados nos botões de login social (SVG embutido, sem pedidos de rede).
 */
const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" /><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.6z" /><path fill="#FBBC05" d="M10.5 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.9-6.1z" /><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" /></svg>
);
const AppleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M16.37 12.64c-.03-2.58 2.1-3.82 2.2-3.88-1.2-1.75-3.07-2-3.74-2.02-1.59-.16-3.1.94-3.91.94-.81 0-2.05-.92-3.37-.9-1.73.03-3.33 1.01-4.22 2.56-1.8 3.12-.46 7.74 1.29 10.27.86 1.24 1.88 2.63 3.22 2.58 1.29-.05 1.78-.84 3.34-.84 1.56 0 2 .84 3.37.81 1.39-.02 2.27-1.26 3.12-2.5.98-1.43 1.39-2.82 1.41-2.89-.03-.01-2.7-1.04-2.73-4.13zM13.8 5.06c.71-.86 1.19-2.06 1.06-3.25-1.02.04-2.26.68-2.99 1.54-.66.76-1.23 1.98-1.08 3.15 1.14.09 2.3-.58 3.01-1.44z" /></svg>
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
  phone: string; // OPCIONAL. Texto só com DÍGITOS (0–9): exatamente 9, a começar por 82–87. Sem +258, espaços nem letras.
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
    if (!EMAIL_RE.test(id.trim())) return setErrs({ id: "Insira um e-mail válido (ex.: nome@dominio.com)." });
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
 * - Os botões Google e Apple fazem login real (ver src/services/social.ts): o token do fornecedor
 *   é enviado ao backend, que o valida e abre a sessão (cookie httpOnly), tal como no login normal.
 */
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
  const finish = (user: ApiUser, okMsg: string) => {
    s.setProfile(user); // o ícone de perfil passa a mostrar os dados desta conta
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
  // Pré-carrega os SDKs do Google/Apple para o popup abrir logo ao clicar (evita bloqueio do browser).
  useEffect(() => { preloadSocial(); }, []);
  // Login com Google / Apple: abre o popup do fornecedor e o backend valida o token.
  const social = async (provider: SocialProvider) => {
    if (loading) return;
    if (mode === "Registar" && !terms) return setErr(TERMS_MSG);
    setErr("");
    setLoading(true);
    try {
      const user = await socialLogin(provider);
      finish(user, "Sessão iniciada.");
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
      if (phone && !PHONE_RE.test(f.phone)) next.phone = "Escreva 9 dígitos, a começar por 82–87.";
      if (f.pw && f.pw.length < 8) next.pw = "Use pelo menos 8 caracteres.";
      else if (f.pw && !(/[A-Za-z]/.test(f.pw) && /\d/.test(f.pw))) next.pw = "Use letras e pelo menos um número.";
      if (f.pw !== f.pw2) next.pw2 = "As palavras-passe não coincidem.";
      if (!terms) return setErr(TERMS_MSG);
    }
    setFieldErrors(next);
    if (Object.keys(next).length) return;
    setLoading(true);
    try {
      let user: ApiUser;
      if (mode === "Registar") {
        // E-mail obrigatório (é para onde vai o código de recuperação da palavra-passe); telefone opcional.
        user = (await api.register({ name: f.name.trim(), email, ...(phone ? { phone } : {}), password: f.pw })).user;
      } else {
        user = (await api.login({ identifier: f.id.trim(), password: f.pw, remember })).user;
      }
      finish(user, mode === "Registar" ? "Conta criada com sucesso!" : "Sessão iniciada.");
    } catch (error) {
      if (error instanceof ApiError && error.fields) {
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
  // Força da palavra-passe: Forte (10+ caracteres, maiúscula, número e símbolo), Média ou Fraca.
  const strength = f.pw.length >= 10 && /[A-Z]/.test(f.pw) && /\d/.test(f.pw) && /[^A-Za-z0-9]/.test(f.pw) ? "Forte" : f.pw.length >= 6 && (/[A-Z]/.test(f.pw) || /\d/.test(f.pw)) ? "Média" : f.pw ? "Fraca" : "";
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
        {reg && <div className="field"><label htmlFor="au-phone">Telefone (opcional)</label><input id="au-phone" {...FIELD.phone} value={f.phone} onChange={set("phone", onlyPhone)} aria-invalid={!!fieldErrors.phone} />{fieldErrors.phone && <small className="field-error">{fieldErrors.phone}</small>}</div>}
        <div className="field"><label htmlFor="au-pw">Palavra-passe</label>
          <div className="pw"><input id="au-pw" maxLength={128} type={show ? "text" : "password"} autoComplete={reg ? "new-password" : "current-password"} value={f.pw} onChange={set("pw")} aria-invalid={!!fieldErrors.pw} /><button type="button" className="pw-toggle" aria-label={show ? "Ocultar palavra-passe" : "Mostrar palavra-passe"} onClick={() => setShow(!show)}>{show ? "◉" : "◌"}</button></div>
          {fieldErrors.pw && <small className="field-error">{fieldErrors.pw}</small>}
          {reg && f.pw && <div className={`strength ${strength.toLowerCase()}`}><span></span><span></span><span></span><b>{strength}</b></div>}
        </div>
        {reg && <div className="field"><label htmlFor="au-pw2">Confirmar palavra-passe</label><input id="au-pw2" maxLength={128} type={show ? "text" : "password"} autoComplete="new-password" value={f.pw2} onChange={set("pw2")} aria-invalid={!!fieldErrors.pw2} />{fieldErrors.pw2 && <small className="field-error">{fieldErrors.pw2}</small>}</div>}
        {!reg && <div className="auth-opts"><button type="button" className="link" onClick={() => switchMode("Recuperar")}>Esqueceu a palavra-passe?</button><label className="check"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Manter sessão iniciada</label></div>}
        {reg && <label className="check terms"><input type="checkbox" checked={terms} onChange={(e) => { setTerms(e.target.checked); setErr(""); }} /><span>Li e aceito os <LegalLinks />.</span></label>}
        {err && <p className="auth-err" role="alert">{err}</p>}
        <button type="submit" className="btn full" disabled={loading}>{loading ? "A processar..." : reg ? "Criar conta" : "Entrar"}</button>
        <div className="auth-or" role="separator"><span>ou continue com</span></div>
        <div className="social-auth"><button type="button" className="btn ghost social-btn" disabled={loading} onClick={() => social("google")}><GoogleIcon /><span>Google</span></button><button type="button" className="btn ghost social-btn" disabled={loading} onClick={() => social("apple")}><AppleIcon /><span>Apple</span></button></div>
        <button type="button" className="link auth-link guest" onClick={() => { s.setUser(false); s.setProfile(null); s.go("home"); }}>Continuar como convidado</button>
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
const CatIcon = ({ name, iconUrl }: { name: string; iconUrl?: string }) => iconUrl ? (
  <img src={iconUrl} alt="" width={28} height={28} loading="lazy" style={{ objectFit: "contain" }} />
) : (
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
    {catIcons[name] ?? catIcons["Todas"]}
  </svg>
);


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
  // Math.max(1, ...) impede quantidades menores que 1.
  const decrease = () => setQuantity((value) => Math.max(1, value - 1));
  const increase = () => setQuantity((value) => value + 1);
  // Adiciona a quantidade escolhida ao carrinho e leva o utilizador ao carrinho.
  const addProduct = () => {
    s.add(product.id, quantity);
    s.showToast("✓ Produto adicionado ao carrinho");
    s.go("cart");
  };

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

      <div className="product-detail-grid">
        {/* Galeria principal do produto. */}
        <div className="product-gallery">
          <div className="product-main-image">
            <div className="product-detail-placeholder" aria-hidden="true">
              <span>{product.name.charAt(0).toUpperCase()}</span>
            </div>

            {/* Favorito em destaque sobre a imagem. */}
            <button
              type="button"
              className={"product-detail-favorite" + (favorite ? " on" : "")}
              aria-label={favorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
              aria-pressed={favorite}
              title={favorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
              onClick={() => { s.toggle(product.id); s.showToast(favorite ? "Removido dos favoritos" : "✓ Adicionado aos favoritos"); }}
            >
              <FavoriteIcon active={favorite} />
            </button>
          </div>

          {/* Miniaturas preparadas para futuras imagens reais. */}
          <div className="product-thumbnails" role="group" aria-label="Vistas do produto">
            {[0, 1, 2].map((view) => (
              <button
                type="button"
                key={view}
                className={"product-thumbnail" + (selectedView === view ? " on" : "")}
                aria-label={`Ver imagem ${view + 1}`}
                aria-pressed={selectedView === view}
                onClick={() => setSelectedView(view)}
              >
                <span aria-hidden="true">{product.name.charAt(0).toUpperCase()}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Informações comerciais e ações de compra. */}
        <div className="product-detail-info">
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

          {/* Benefícios visuais da loja. */}
          <div className="product-benefits">
            <div className="product-benefit">
              <span className="benefit-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 14.5a2.75 2.75 0 1 0 0 5.5 2.75 2.75 0 0 0 0-5.5zM19 14.5a2.75 2.75 0 1 0 0 5.5 2.75 2.75 0 0 0 0-5.5zM7 12h5l2.5 2.5h-6.5M8.5 14.5v3h5.5v-3M17 14.5l-1.5-5h2.5M5 17.25H8" />
                </svg>
              </span>
              <div><strong>Entrega rápida</strong><small>Escolha a modalidade no checkout.</small></div>
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
        </div>
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
 * Página inicial: hero em destaque, filtros por categoria/preço/ordem e vitrines de produtos.
 */
const Home = ({ s }: { s: Store }) => {
  // `loading` simula o tempo de carregamento para mostrar o esqueleto (SkeletonGrid).
  const [loading, setLoading] = useState(true);
  const [g, setG] = useState(""); const [sub, setSub] = useState("");
  const [sort, setSort] = useState(""); const [min, setMin] = useState(""); const [max, setMax] = useState("");
  const [fopen, setFopen] = useState(false);
  // Termina o "carregamento" simulado após 500 ms; a função devolvida cancela o temporizador.
  useEffect(() => { const timer = window.setTimeout(() => setLoading(false), 500); return () => window.clearTimeout(timer); }, []);
  const groups = Object.keys(categories);
  // Produtos do grupo escolhido (ou todos, se nenhum grupo estiver selecionado).
  const inGroup = products.filter((p) => !g || p.group === g);
  // Aplica subcategoria e intervalo de preço; depois ordena por preço, se pedido.
  let list = inGroup.filter((p) => (!sub || p.cat === sub) && (!min || p.price >= +min) && (!max || p.price <= +max));
  if (sort) list = [...list].sort((a, b) => (sort === "asc" ? a.price - b.price : b.price - a.price));
  // true quando há algum filtro ativo; nesse caso esconde as vitrines e mostra só os resultados.
  const filtering = !!(g || sort || min || max);
  const selectGroup = (c: string) => { setG(c); setSub(""); };
  // Clicar de novo na categoria já selecionada desmarca-a (comportamento de alternar).
  const pick = (c: string) => selectGroup(c === g ? "" : c);
  const reset = () => { setG(""); setSub(""); setSort(""); setMin(""); setMax(""); };
  return (
    <>
      {/* ------------------------------------------------------------------ */}
      {/* HERO PRINCIPAL — melhoria 05                                         */}
      {/* ------------------------------------------------------------------ */}
      {/* A área principal apresenta a campanha atual e duas ações claras,
          aproveitando as imagens de produto que já existem no projeto. */}
      <section className="hero hero-v5" aria-labelledby="hero-title">
        <div className="hero-text hero-v5-copy">
          <span className="hero-kicker">DESTAQUE DA LOJA</span>
          <h1 id="hero-title">Fones sem fios para acompanhar o seu dia.</h1>
          <p>Descubra opções de áudio e outros acessórios tecnológicos disponíveis na NhongaExpress.</p>

          {/* Ações principais do hero. */}
          <div className="hero-actions">
            <button className="btn light" onClick={() => s.go("categories")}>
              Explorar categorias
            </button>
            <button className="btn hero-secondary" onClick={() => s.go("search")}>
              Ver produtos
            </button>
          </div>

        </div>

        {/* Área visual com as imagens reais já existentes no frontend. */}
        <div className="hero-v5-visual">
          <div className="hero-v5-glow" aria-hidden="true" />
          <div className="hero-product hero-product-main">
            <img src={fone1} alt="Fone Bluetooth preto e vermelho" />
          </div>
          <div className="hero-product hero-product-secondary">
            <img src={fone2} alt="Fone sobre a orelha preto e vermelho" />
          </div>

          {/* Etiqueta visual contextual, sem preço ou desconto inventado. */}
          <div className="hero-badge">
            <span className="hero-badge-label">Em destaque</span>
            <strong>Áudio</strong>
          </div>
        </div>
      </section>

      {/* Comprar por categoria: filtros à esquerda e categorias/resultados à direita. */}
      <section className="shop" aria-label="Comprar por categoria">
        <div className="shop-head">
          <h2>Comprar por categoria</h2>
          <button className="link" onClick={() => s.go("categories")}>Ver todas →</button>
        </div>

        <button className="btn ghost f-toggle" aria-expanded={fopen} aria-controls="shop-filters" onClick={() => setFopen(!fopen)}>
          {fopen ? "Fechar filtros ✕" : "Filtrar e ordenar"}{!fopen && filtering ? " •" : ""}
        </button>

        <div className="shop-layout">
          {/* Coluna esquerda: todas as opções de filtragem (no telemóvel abre/fecha) */}
          <aside id="shop-filters" className={"shop-filters" + (fopen ? " open" : "")} aria-label="Filtros">
            <h3>Filtrar</h3>

            <p className="f-title">Ordenar por</p>
            <ul className="f-list">
              {([["asc", "Preço: menor para maior"], ["desc", "Preço: maior para menor"]] as [string, string][]).map(([v, label]) => (
                <li key={v}>
                  <button className={"f-row" + (sort === v ? " on" : "")} aria-pressed={sort === v} onClick={() => setSort(sort === v ? "" : v)}>
                    <span>{label}</span><span className="arrow" aria-hidden="true">›</span>
                  </button>
                </li>
              ))}
            </ul>

            <p className="f-title">Preço</p>
            <ul className="f-list">
              <li><label className="f-row f-input"><input type="number" min={0} value={min} onChange={(e) => setMin(e.target.value)} placeholder="Preço mín." aria-label="Preço mínimo" /><span className="arrow" aria-hidden="true">›</span></label></li>
              <li><label className="f-row f-input"><input type="number" min={0} value={max} onChange={(e) => setMax(e.target.value)} placeholder="Preço máx." aria-label="Preço máximo" /><span className="arrow" aria-hidden="true">›</span></label></li>
            </ul>

            {g && (
              <>
                <p className="f-title">Subcategorias</p>
                <ul className="f-list">
                  <li>
                    <button className={"f-row" + (!sub ? " on" : "")} aria-pressed={!sub} onClick={() => setSub("")}>
                      <span>Todas <em>{inGroup.length}</em></span><span className="arrow" aria-hidden="true">›</span>
                    </button>
                  </li>
                  {categories[g].map((c) => {
                    const n = inGroup.filter((p) => p.cat === c).length;
                    return (
                      <li key={c}>
                        <button className={"f-row" + (sub === c ? " on" : "")} aria-pressed={sub === c} disabled={!n} onClick={() => setSub(sub === c ? "" : c)}>
                          <span>{c} <em>{n}</em></span><span className="arrow" aria-hidden="true">›</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}

            {filtering && <button className="btn ghost full" onClick={reset}>Limpar filtros ✕</button>}
          </aside>

          {/* Coluna direita: categorias */}
          <div className="shop-main">
            <div className="cat-tiles" role="group" aria-label="Categorias">
              {["Todas", ...groups].map((c) => {
                const on = c === "Todas" ? !g : g === c;
                const n = c === "Todas" ? products.length : products.filter((p) => p.group === c).length;
                return (
                  <button key={c} className={"tile" + (on ? " on" : "")} aria-pressed={on} onClick={() => (c === "Todas" ? selectGroup("") : pick(c))}>
                    <span className="tile-ico"><CatIcon name={c} /></span>
                    <span className="tile-name">{c}</span>
                    <small>{n} {n === 1 ? "produto" : "produtos"}</small>
                  </button>
                );
              })}
            </div>

            {filtering && (
              <div className="filter-panel">
                <div className="filter-top">
                  <div><h3>{g || "Todas as categorias"}</h3><small>{list.length} {list.length === 1 ? "resultado" : "resultados"}{sub ? ` em ${sub}` : ""}</small></div>
                </div>
                <Grid list={list} s={s} />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Vitrines (ofertas, novidades, ...). Cada uma mostra uma fatia fixa do catálogo;
         é um placeholder até existir lógica real de promoções e vendas. */}
      {!filtering && (["Ofertas e promoções", "Novidades", "Mais vendidos", "Recomendados para si"].map((t, idx) => {
        const ranges: [number, number][] = [[0, 4], [4, 8], [2, 6], [8, 12]];
        const [a, b] = ranges[idx];
        return <section key={t}><h2>{t}</h2>{loading ? <SkeletonGrid count={4} /> : <Grid list={products.slice(a, b)} s={s} />}</section>;
      }))}
    </>
  );
};

// Página de categorias: escolher um grupo à esquerda e, opcionalmente, uma subcategoria.
const Categories = ({ s }: { s: Store }) => {
  const [g, setG] = useState(Object.keys(categories)[0]); const [sub, setSub] = useState("");
  return (
    <div className="split">
      <aside>{Object.keys(categories).map((c) => <button key={c} className={g === c ? "on" : ""} onClick={() => { setG(c); setSub(""); }}>{c}</button>)}</aside>
      <div><div className="chips">{categories[g].map((c) => <button key={c} className={sub === c ? "on" : ""} onClick={() => setSub(sub === c ? "" : c)}>{c}</button>)}</div>
        <Grid list={products.filter((p) => p.group === g && (!sub || p.cat === sub))} s={s} /></div>
    </div>
  );
};

/**
 * Página de pesquisa com filtros combinados (categoria, marca, preço, avaliação, disponibilidade) e ordenação.
 */
const Search = ({ s }: { s: Store }) => {
  const { q, setQ } = s;
  const [g, setG] = useState("");
  const [brand, setBrand] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [rating, setRating] = useState("");
  const [availability, setAvailability] = useState("");
  const [sort, setSort] = useState("");
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
              <option value="4">4★ ou mais</option>
              <option value="4.5">4,5★ ou mais</option>
              <option value="4.8">4,8★ ou mais</option>
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
  <section><h2>Lista de desejos</h2>
    {s.wish.length ? <div className="grid">{s.wish.map((id) => { const p = byId(id); return (
      <div className="card" key={id}><div className="img">{p.name[0]}</div><h4>{p.name}</h4><b>{fmt(p.price)}</b>
        <div className="row"><button className="btn" onClick={() => { s.add(id); s.toggle(id); s.showToast("✓ Produto adicionado ao carrinho"); }}>Mover para o carrinho</button>
          <button className="btn ghost" onClick={() => { s.toggle(id); s.showToast("Removido dos favoritos"); }}>Remover</button></div></div>); })}</div>
      : <p className="muted">Ainda não guardou nenhum produto.</p>}
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
  // Qualquer alteração ao carrinho invalida o resultado anterior (evita mostrar avisos desatualizados).
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
      console.error("[validateCart] falhou:", e); // ver o erro real no F12 > Console
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
      <div><h2>Carrinho</h2>{ids.map((id) => { const p = byId(id); return (
        <div className="line" key={id}><div className="img sm">{p.name[0]}</div><div className="grow"><h4>{p.name}</h4><small>{fmt(p.price)}</small>
            {issues[id] && <small className="auth-err" role="alert" style={{ display: "block" }}>{issues[id].message}</small>}</div>
          <div className="qty"><button onClick={() => s.add(id, -1)}>−</button><span>{s.cart[id]}</span>
            <button disabled={s.cart[id] >= Math.min(p.stock ?? 99, 99)} title={s.cart[id] >= (p.stock ?? 99) ? "Stock máximo atingido" : undefined} onClick={() => s.add(id, 1)}>+</button></div>
          <button className="link" onClick={() => { if (window.confirm("Remover este produto do carrinho?")) { s.add(id, -s.cart[id]); s.showToast("Produto removido do carrinho"); } }}>Remover</button></div>); })}</div>
      <div className="panel"><h3>Resumo do pedido</h3>
        <div className="bar"><input type="text" maxLength={30} value={code} onChange={(e) => setCode(e.target.value)} aria-label="Código do cupão" /><button className="btn ghost" onClick={() => setOk(VALID_COUPONS.includes(code.trim().toUpperCase()))}>Aplicar</button></div>
        <p className="sum"><span>Subtotal</span><span>{fmt(sub)}</span></p>
        {ok && <p className="sum"><span>Desconto</span><span>−{fmt(disc)}</span></p>}
        <p className="sum total"><span>Total</span><span>{fmt(sub - disc)}</span></p>
        {check && !check.ok && <button className="btn ghost full" onClick={adjust}>Ajustar carrinho ao stock disponível</button>}
        <button className="btn full" disabled={checking} onClick={proceed}>{checking ? "A verificar stock..." : "Finalizar compra"}</button></div>
    </div>
  );
};

// Etapas do checkout, na ordem em que aparecem.
const steps = ["Morada", "Entrega", "Pagamento", "Revisão", "Confirmação"];
/** uuid v4 para a chave de idempotência (crypto.randomUUID só existe em contexto seguro: https/localhost). */
const newAttemptKey = () =>
  globalThis.crypto?.randomUUID?.() ??
  "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => { const r = (Math.random() * 16) | 0; return (c === "x" ? r : (r & 3) | 8).toString(16); });
/**
 * Checkout em passos. O índice `i` indica a etapa atual (0 = Morada ... 4 = Confirmação).
 * É um fluxo de demonstração: não há pagamento nem criação real de pedidos.
 */
const Checkout = ({ s }: { s: Store }) => {
  const [i, setI] = useState(0);
  const [address, setAddress] = useState("");
  const [delivery, setDelivery] = useState("Normal (3–5 dias)");
  const [payment, setPayment] = useState("Pagamento na entrega");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [orderId, setOrderId] = useState<string | null>(null);
  // --- Proteção contra pedidos duplicados ---
  // `inFlight` (ref, não estado) trava cliques repetidos NO MESMO INSTANTE: o estado `busy` só atualiza no render seguinte.
  const inFlight = useRef(false);
  // Uma chave por tentativa de compra: se o pedido for repetido (duplo clique, falha de rede), o servidor devolve o mesmo pedido.
  const attemptKey = useRef(newAttemptKey());
  const [dupOrderId, setDupOrderId] = useState<string | null>(null);
  // --- Verificação de stock na Revisão (antes de "Fazer pedido") ---
  const [check, setCheck] = useState<CartCheck | null>(null);
  const [checking, setChecking] = useState(false);
  const cartItems = () => Object.entries(s.cart).map(([productId, quantity]) => ({ productId, quantity }));
  const runCheck = async () => {
    setChecking(true);
    try { setCheck(await api.validateCart(cartItems())); }
    catch { setCheck(null); } // sem resposta: não bloqueia; o servidor volta a conferir ao criar o pedido
    finally { setChecking(false); }
  };
  useEffect(() => { if (i === 3) void runCheck(); }, [i]);
  const blocked = checking || (check !== null && !check.ok);
  const opts: Record<number, string[]> = { 1: ["Normal (3–5 dias)", "Expresso (24 h)"], 2: ["M-Pesa", "e-Mola", "Pagamento na entrega"] };

  const placeOrder = async () => {
    if (inFlight.current || blocked) return; // já há um pedido a ser enviado, ou o stock não está garantido
    inFlight.current = true; setBusy(true); setError(""); setDupOrderId(null);
    try {
      const { order } = await api.createOrder({
        items: cartItems(),
        paymentMethod: payment, shippingAddress: address.trim(), deliveryMethod: delivery,
        idempotencyKey: attemptKey.current,
      });
      setOrderId(order.id);
      Object.keys(s.cart).forEach((id) => s.add(id, -s.cart[id])); // pedido feito: esvazia o carrinho já (não fica para repetir)
      setI(4); // a trava `inFlight` fica ligada de propósito: este checkout já não pode enviar mais nenhum pedido
      return;
    } catch (e) {
      inFlight.current = false;
      if (e instanceof ApiError) {
        // 4xx: o pedido NÃO foi criado -> próxima tentativa usa chave nova.
        // Sem resposta (0) ou 5xx: o pedido PODE ter sido criado -> mantém a MESMA chave, repetir é seguro.
        if (e.status >= 400 && e.status < 500) attemptKey.current = newAttemptKey();
        if (e.fields?.orderId) setDupOrderId(e.fields.orderId); // pedido idêntico já existente
        if (e.status === 409) void runCheck(); // stock mudou: mostra o que falhou
      }
      setError(e instanceof ApiError ? e.message : "Não foi possível criar o pedido.");
    } finally { setBusy(false); }
  };

  if (i === 0) return <div className="panel">
    <div className="steps">{steps.map((t, n) => <span key={t} className={n <= i ? "on" : ""}>{n + 1}. {t}</span>)}</div>
    <h2>Morada de entrega</h2><p className="muted">Indique onde pretende receber a sua compra.</p>
    <div className="field"><label htmlFor="checkout-address">Morada completa</label><textarea id="checkout-address" rows={4} maxLength={300} value={address} onChange={e => setAddress(e.target.value)} /></div>
    {error && <p className="auth-err" role="alert">{error}</p>}
    <button className="btn" disabled={!address.trim()} onClick={() => setI(1)}>Continuar</button>
  </div>;

  return <div className="panel">
    <div className="steps">{steps.map((t, n) => <span key={t} className={n <= i ? "on" : ""}>{n + 1}. {t}</span>)}</div>
    {i === 1 && <><h2>Entrega</h2><div className="opts">{opts[1].map(o => <label key={o}><input type="radio" name="delivery" checked={delivery === o} onChange={() => setDelivery(o)} /> {o}</label>)}</div></>}
    {i === 2 && <><h2>Pagamento</h2><div className="opts">{opts[2].map(o => <label key={o}><input type="radio" name="payment" checked={payment === o} onChange={() => setPayment(o)} /> {PAY_ICONS[o] ?? o}</label>)}</div></>}
    {i === 3 && <><h2>Revisão do pedido</h2><p className="muted">Entrega: {delivery}</p><p className="muted">Pagamento: {payment}</p><p className="muted">Morada: {address}</p><p className="sum total"><span>Total a pagar</span><span>{fmt(cartTotal(s.cart))}</span></p>
      {checking && <p className="muted">A verificar stock...</p>}
      {check && !check.ok && <div role="alert" className="auth-err">{check.items.filter((it) => it.status !== "ok").map((it) => <p key={it.productId}>{it.message}</p>)}
        <button className="btn ghost" onClick={() => s.go("cart")}>Voltar ao carrinho e ajustar</button></div>}</>}
    {i === 4 && <><h2>Pedido confirmado</h2><p className="muted">O seu pedido foi registado com sucesso.</p><p><strong>Número do pedido:</strong> {orderId}</p><p className="muted">O stock foi atualizado e o pedido já está disponível no painel administrativo.</p></>}
    {error && <p className="auth-err" role="alert">{error}</p>}
    {dupOrderId && <p><button className="link" onClick={() => s.openAccount("Pedidos")}>Ver os meus pedidos</button></p>}
    <div className="row">{i > 0 && i < 4 && <button className="btn ghost" onClick={() => setI(i - 1)}>Voltar</button>}
      {i < 3 && <button className="btn" onClick={() => setI(i + 1)}>Continuar</button>}
      {i === 3 && <button className="btn" disabled={busy || blocked} onClick={placeOrder}>{busy ? "A processar..." : checking ? "A verificar stock..." : "Fazer pedido"}</button>}
      {i === 4 && <button className="btn" onClick={() => { Object.keys(s.cart).forEach(id => s.add(id, -s.cart[id])); s.go("home"); }}>Voltar à loja</button>}</div>
  </div>;
};

// Secções da área de conta e respetiva descrição (conteúdo provisório).
const sections: Record<string, string> = {
  "Informações do perfil": "Nome, e-mail, telefone e foto.", "Pedidos": "Detalhes, acompanhar pedido, devoluções e reembolsos.",
  "Moradas": "Adicionar, editar e definir morada padrão.", "Métodos de pagamento": "M-Pesa, e-Mola e pagamento na entrega.",
  "Definições": "Idioma, notificações e privacidade.", "Ajuda e suporte": "Perguntas frequentes e contacto.", "Sobre nós": "Conheça a NhongaExpress.",
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
      <aside>{Object.keys(sections).map((k) => <button key={k} className={sec === k ? "on" : ""} onClick={() => setSec(k)}>{k}</button>)}
        {s.profile?.role === "admin" && <button onClick={() => window.location.assign(ADMIN_BASE)}>Painel administrativo</button>}
        <button onClick={() => { api.logout().catch(() => {}); s.setUser(false); s.setProfile(null); s.go("auth"); }}>Terminar sessão</button></aside>
      <div className="panel"><h2>{sec}</h2>
        {sec === "Informações do perfil" ? <Profile s={s} /> : <p className="muted">{sections[sec]}</p>}
      </div>
    </div>
  );
};

// Perguntas frequentes (pares [pergunta, resposta]).
const faq: [string, string][] = [
  ["Como faço uma compra?", "Adicione os produtos ao carrinho, clique em Finalizar compra e siga os passos: morada, entrega, pagamento e revisão."],
  ["Onde uso o cupão de desconto?", "No carrinho, no campo Cupão do resumo do pedido."],
  ["Preciso de ajuda com um pedido.", "Fale connosco através da página Contacto, indicando o número do pedido."],
];
// Aviso reutilizável para textos legais ainda provisórios.
const draft = <p className="muted">Texto provisório. Substitua pelo texto legal definitivo da loja.</p>;
/**
 * Conteúdo das páginas informativas, indexado pelo título.
 * A página Info escolhe o tópico a mostrar com base em `s.info`.
 */
const topics: Record<string, JSX.Element> = {
  "Sobre nós": <p>A NhongaExpress é uma loja online de acessórios e tecnologia: telemóveis, áudio, computadores, energia, internet, automóveis, fotografia e gadgets. O nosso objetivo é oferecer produtos úteis, a bom preço e com entrega rápida. Atuamos somente na cidade da Beira.</p>,
  "Central de ajuda": <>{faq.map(([q, a]) => <div key={q}><h4>{q}</h4><p className="muted">{a}</p></div>)}</>,
  "Entregas": <><p>Entregamos somente na cidade da Beira. Escolhe a opção de entrega no passo Entrega, ao finalizar a compra.</p><ul><li>Normal: 3–5 dias</li><li>Expresso: 24 h</li></ul></>,
  "Pagamentos": <><p>Aceitamos as seguintes formas de pagamento:</p><ul><li className="pay-li">{PAY_ICONS["M-Pesa"]}{PAY_ICONS["e-Mola"]}</li><li>Pagamento na entrega</li></ul></>,
  "Trocas e devoluções": <p>Se o produto chegar com defeito, danificado ou diferente do que encomendou, contacte-nos com o número do pedido e fotografias. Analisaremos o caso e indicaremos a troca ou o reembolso.</p>,
  "Contacto": <ul>{company.phone && <li>Telefone: <a href={`tel:${company.phone.replace(/\s/g, "")}`}>{company.phone}</a></li>}{company.whatsapp && <li>WhatsApp: <a href={`https://wa.me/${company.whatsapp}`}>{company.phone || "Enviar mensagem"}</a></li>}{company.email && <li>E-mail: <a href={`mailto:${company.email}`}>{company.email}</a></li>}{company.hours && <li>Horário: {company.hours}</li>}{!company.phone && !company.whatsapp && !company.email && <li>Contactos disponíveis em breve.</li>}</ul>,
  "Termos de uso": <><p>Ao utilizar a NhongaExpress, aceita as condições de compra, entrega, pagamento e devolução aplicáveis aos produtos da loja.</p>{draft}</>,
  "Política de privacidade": <><p>Recolhemos apenas os dados necessários para processar os seus pedidos e melhorar a sua experiência. Não vendemos os seus dados a terceiros.</p>{draft}</>,
};

/**
 * Página "Sobre nós": história, missão e vantagens da loja.
 */
const About = ({ s }: { s: Store }) => {
  // Vantagens apresentadas como cartões; `icon` guarda o desenho SVG (atributo `d` do path).
  const highlights = [
    { title: "Entrega rápida", text: "Entregamos na cidade da Beira, com opções de entrega pensadas para o seu dia a dia.", icon: "M5 14.5a2.75 2.75 0 1 0 0 5.5 2.75 2.75 0 0 0 0-5.5zM19 14.5a2.75 2.75 0 1 0 0 5.5 2.75 2.75 0 0 0 0-5.5zM7 12h5l2.5 2.5h-6.5M8.5 14.5v3h5.5v-3M17 14.5l-1.5-5h2.5M5 17.25H8" },
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
          <p className="about-coverage">Atuamos somente na cidade da Beira.</p>
          <button className="btn" onClick={() => s.go("categories")}>Explorar produtos</button>
        </div>
        <div className="about-visual" aria-label="Ilustração da NhongaExpress">
          <div className="about-orb orb-one" /><div className="about-orb orb-two" />
          <div className="about-device">
            <div className="about-device-top"><span>Nhonga</span><b>Express</b></div>
            <div className="about-device-screen"><span>Compra fácil</span><strong>Entrega na Beira</strong><i>✓</i></div>
          </div>
          <div className="about-box">NHONGA<br/><strong>EXPRESS</strong></div>
        </div>
      </section>

      <section className="about-story">
        <div><span className="eyebrow">Quem somos</span><h2>Feitos para tornar a compra mais simples</h2></div>
        <div><p>A NhongaExpress é uma loja online de acessórios e tecnologia, com produtos para diferentes necessidades: áudio, computadores, energia, internet, automóveis, fotografia, gadgets e muito mais.</p><p>Queremos reunir variedade, preço competitivo, facilidade de compra e atendimento próximo numa única experiência.</p><p>Atuamos somente na cidade da Beira. É assim que garantimos entregas rápidas e um atendimento mais próximo dos nossos clientes.</p></div>
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
  "search",
  "bell",
  "cart",
];

/* Ícone do sino. */
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
  const [page, go] = useState<Page>("home");
  // true = utilizador autenticado. Ao abrir a app perguntamos ao backend se já há sessão (cookie).
  const [user, setUser] = useState(false);
  // Dados da conta (nome, e-mail, telefone...) devolvidos pelo servidor; alimentam o ícone e a página de perfil.
  const [profile, setProfile] = useState<ApiUser | null>(null);
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
    });
  }, []);
  useEffect(() => {
    api.products().then(({ products: rows }) => {
      setProducts(rows.map((p) => ({
        id: p.id, name: p.name, group: p.category, cat: p.category, price: p.price,
        description: p.description, image: p.image, stock: p.stock, active: p.active, available: p.stock > 0 && p.active
      })));
    }).catch(() => {});
  }, []);
  // Carrinho como objeto { idDoProduto: quantidade }. Ex.: { 3: 2 } = 2 unidades do produto 3.
  const [cart, setCart] = useState<Record<string, number>>({});
  // Lista de desejos: apenas os ids dos produtos favoritos.
  const [wish, setWish] = useState<string[]>([]);
  const [info, setInfo] = useState("Sobre nós");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  // Sino de notificações: só abre com sessão iniciada. A posição do painel é calculada a partir do botão.
  const [bellOpen, setBellOpen] = useState(false);
  const [bellPos, setBellPos] = useState({ top: 0, right: 8 });
  const bellBtnRef = useRef<HTMLButtonElement>(null);
  const bellPanelRef = useRef<HTMLDivElement>(null);
  // Secção da conta a abrir (Moradas, Métodos de pagamento...). Volta ao perfil quando se sai da conta.
  const [accountTarget, setAccountTarget] = useState({ sec: "Informações do perfil" });
  // Mensagem de feedback temporária ("Produto adicionado...").
  // `toastKey` muda a cada mensagem para reiniciar o temporizador e a animação.
  const [toast, setToast] = useState<string | null>(null);
  const [toastKey, setToastKey] = useState(0);

  /* Guarda o produto selecionado para a página de detalhe. */
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

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
    setUser,
    q,
    setQ,
    info,
    setInfo,
    selectedProductId,
    showToast: (message) => { setToast(message); setToastKey((k) => k + 1); },

    accountTarget,
    openAccount: (sec) => { setAccountTarget({ sec }); go("account"); },

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
      const target = event.target as Node;
      if (bellPanelRef.current?.contains(target) || bellBtnRef.current?.contains(target)) return;
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

  /* Clique no sino: sem sessão leva ao login; com sessão abre/fecha o painel. */
  const toggleBell = () => {
    if (!user) {
      s.showToast("Inicie sessão para ver as suas notificações.");
      go("auth");
      return;
    }
    const rect = bellBtnRef.current?.getBoundingClientRect();
    if (rect) setBellPos({ top: rect.bottom + 8, right: Math.max(8, window.innerWidth - rect.right) });
    setBellOpen((value) => !value);
  };

  /* Opções do painel do sino. As quatro primeiras abrem a área de conta na secção certa. */
  const bellOptions: { label: string; icon: string; run: () => void }[] = [
    { label: "Moradas", icon: "M12 21s7-5.2 7-11a7 7 0 1 0-14 0c0 5.8 7 11 7 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z", run: () => s.openAccount("Moradas") },
    { label: "Métodos de pagamento", icon: "M3 6h18v12H3zM3 10h18M7 15h3", run: () => s.openAccount("Métodos de pagamento") },
    { label: "Definições", icon: "M4 7h9M17 7h3M4 17h3M11 17h9M15 4v6M9 14v6", run: () => s.openAccount("Definições") },
    { label: "Ajuda e suporte", icon: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17h.01", run: () => { s.setInfo("Central de ajuda"); go("info"); } },
    { label: "Sobre nós", icon: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 16v-4M12 8h.01", run: () => go("about") },
  ];

  /* ------------------------------------------------------------------------ */
  /* Seleção da página atual                                                   */
  /* ------------------------------------------------------------------------ */
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
  const View = view;

  /* ------------------------------------------------------------------------ */
  /* Preparação das sugestões de pesquisa                                     */
  /* ------------------------------------------------------------------------ */
  /* A pesquisa utiliza os produtos e categorias existentes no frontend. */
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
        <div className="hsearch">
          <input
            value={q}
            aria-label="Pesquisar produtos"
            placeholder="Pesquisar produtos..."
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

        {/* ------------------------------------------------------------------ */}
        {/* Navegação por ícones                                                 */}
        {/* ------------------------------------------------------------------ */}
        <nav aria-label="Navegação principal">
          {nav.map((item) => {
            // Sino de notificações (substitui o coração da lista de desejos).
            if (item === "bell") {
              return (
                <button
                  key="bell"
                  ref={bellBtnRef}
                  type="button"
                  className={`ico-only ${bellOpen ? "on" : ""}`}
                  aria-label="Notificações"
                  title="Notificações"
                  aria-haspopup="menu"
                  aria-expanded={user ? bellOpen : undefined}
                  onClick={toggleBell}
                >
                  <Icon d={BELL_PATH} size={19} />
                </button>
              );
            }

            return (
              <button
                key={item}
                type="button"
                className={`ico-only ${page === item ? "on" : ""}`}
                aria-label={navLabels[item]}
                title={navLabels[item]}
                onClick={() => go(item)}
              >
                <NavIcon page={item} avatar={avatar} />

                {/* Badge do carrinho. Só aparece quando existe pelo menos um item. */}
                {item === "cart" && count > 0 && (
                  <span className="cart-badge" aria-label={`${count} itens`}>
                    {count}
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
        {/* Autenticação                                                         */}
        {/* ------------------------------------------------------------------ */}
        {/* O ícone muda conforme o estado da sessão do utilizador. */}
        {/* Ícone de perfil, logo à esquerda do botão Entrar/Sair. Quem não tem sessão
            e clica nele é levado ao ecrã de login. No telemóvel fica escondido (usa o menu). */}
        <button
          type="button"
          className={`header-auth ${page === "account" ? "on" : ""}`}
          aria-label={profile ? `Conta de ${profile.name}` : "Conta"}
          title={profile ? profile.name : "Conta"}
          onClick={() => go(user ? "account" : "auth")}
        >
          <NavIcon page="account" avatar={avatar} />
        </button>

        <button
          type="button"
          className={`header-login-btn ${user ? "is-logged" : ""}`}
          aria-label={user ? "Terminar sessão" : "Entrar"}
          title={user ? "Terminar sessão" : "Entrar"}
          onClick={() => {
            if (user) { api.logout().catch(() => {}); setUser(false); setProfile(null); } // termina a sessão também no servidor
            go("auth");
          }}
        >
          {user ? "Sair" : "Entrar"}
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

      {/* Painel do sino (fora do <header> para não ser cortado pelo scroll horizontal da navegação no telemóvel). */}
      {bellOpen && user && (
        <div
          ref={bellPanelRef}
          className="bell-menu"
          role="menu"
          aria-label="Notificações e opções da conta"
          style={{ "--bell-top": `${bellPos.top}px`, "--bell-right": `${bellPos.right}px` } as CSSProperties}
        >
          <div className="bell-menu-head"><strong>Notificações</strong></div>
          <p className="bell-empty">Não tem notificações novas.</p>
          <div className="bell-menu-list">
            {bellOptions.map((option) => (
              <button
                key={option.label}
                type="button"
                role="menuitem"
                onClick={() => { setBellOpen(false); option.run(); }}
              >
                <span className="bell-ico"><Icon d={option.icon} size={18} /></span>
                <span>{option.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Menu lateral (telemóvel). Clicar no fundo escuro fecha-o; o painel usa stopPropagation
         para que cliques dentro dele não o fechem. */}
      {mobileMenuOpen && (
        <div className="mobile-menu-layer" onMouseDown={() => setMobileMenuOpen(false)}>
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

            <div className="mobile-menu-about">
              <strong>Sobre nós</strong>
              <p>A NhongaExpress oferece acessórios e tecnologia para o seu dia a dia, com compra simples, segura e entrega rápida na cidade da Beira.</p>
              <button
                type="button"
                onClick={() => { setMobileMenuOpen(false); go("about"); }}
              >
                Conheça a NhongaExpress
              </button>
            </div>

            <div className="mobile-menu-links">
              {[
                ["account", user ? "Minha conta" : "Entrar"], // perfil é a primeira opção do menu
                ["home", "Início"],
                ["categories", "Categorias"],
                ["search", "Pesquisar"],
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
                    {mobilePage === "cart" && count > 0 && <b>{count}</b>}
                  </button>
                );
              })}

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
                    go("auth");
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
              <button type="button" onClick={() => { setMobileMenuOpen(false); s.setInfo("Contacto"); go("info"); }}>
                Contacto e suporte
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
          {["home", "search", "categories", "wishlist", "account"].map((item) => {
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
                  <NavIcon page={mobilePage} avatar={avatar} />
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
    </>
  );
}


export default StoreApp;
