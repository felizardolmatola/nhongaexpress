/**
 * PaymentIcons.tsx — ícones das carteiras móveis aceites na loja (M-Pesa e e-Mola).
 *
 * São mostrados SÓ como imagem (sem texto). O nome fica em `alt`/`aria-label`
 * para leitores de ecrã e para o tooltip do navegador.
 *
 * Logótipos oficiais: basta colocar `mpesa.png` e `emola.png` (ou .svg/.webp/.jpg)
 * em src/assets/payment/. Se o ficheiro existir, é usado automaticamente; caso
 * contrário, mostra-se um ícone SVG simples de substituição (cores aproximadas).
 */

/* Procura, em tempo de build, as imagens da pasta assets/payment.
   `import.meta.glob` é uma função do Vite: devolve { caminho: url } e, se a pasta
   estiver vazia, devolve {} (sem erro). */
const logoFiles = import.meta.glob("../assets/payment/*.{png,svg,webp,jpg,jpeg}", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

/* Devolve o URL do logótipo cujo nome de ficheiro contém `name` (ex.: "mpesa"). */
const findLogo = (name: string) =>
  Object.entries(logoFiles).find(([path]) => path.toLowerCase().includes(name))?.[1];

/* Logótipo oficial dentro de uma "caixa" branca, para ficar legível em qualquer fundo. */
const Logo = ({ src, label, height }: { src: string; label: string; height: number }) => (
  <img className="pay-logo" src={src} alt={label} title={label} style={{ height }} />
);

/* M-Pesa: fundo verde com a letra "M" branca. */
export const MpesaIcon = ({ height = 44 }: { height?: number }) => {
  const logo = findLogo("mpesa");
  if (logo) return <Logo src={logo} label="M-Pesa" height={height} />;
  return (
  <svg className="pay-icon" height={height} viewBox="0 0 48 32" role="img" aria-label="M-Pesa">
    <title>M-Pesa</title>
    <rect width="48" height="32" rx="6" fill="#43B02A" />
    <path d="M14 23V10l5 8 5-8v13" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="33" cy="22" r="2.2" fill="#E60000" />
  </svg>
  );
};

/* e-Mola: fundo laranja com a letra "e" branca (barra horizontal + arco). */
export const EmolaIcon = ({ height = 44 }: { height?: number }) => {
  const logo = findLogo("emola");
  if (logo) return <Logo src={logo} label="e-Mola" height={height} />;
  return (
  <svg className="pay-icon" height={height} viewBox="0 0 48 32" role="img" aria-label="e-Mola">
    <title>e-Mola</title>
    <rect width="48" height="32" rx="6" fill="#F58220" />
    <path d="M18 16h12a6 6 0 1 0-1.76 4.24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
  );
};

/* Mapa nome -> ícone, usado onde a forma de pagamento aparece em lista (checkout, rodapé, ajuda). */
export const PAY_ICONS: Record<string, JSX.Element> = {
  "M-Pesa": <MpesaIcon />,
  "e-Mola": <EmolaIcon />,
};
