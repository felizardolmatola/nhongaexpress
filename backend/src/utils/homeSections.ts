/**
 * utils/homeSections.ts — as secções da página inicial (única fonte de verdade).
 * Os slugs são o que aparece nos endereços: /api/admin/home-sections/:slug
 * (têm de coincidir com o CHECK da tabela home_section_products).
 */
export const HOME_SECTIONS = {
  featured: { title: "Produto em destaque", limit: 1 },
  offers: { title: "Ofertas e promoções", limit: 12 },
  new: { title: "Novidades", limit: 12 },
  "best-sellers": { title: "Mais vendidos", limit: 12 },
  recommended: { title: "Recomendados para si", limit: 12 },
} as const;

export type HomeSectionSlug = keyof typeof HOME_SECTIONS;
export const HOME_SECTION_SLUGS = Object.keys(HOME_SECTIONS) as HomeSectionSlug[];
export const isHomeSection = (v: string): v is HomeSectionSlug => Object.prototype.hasOwnProperty.call(HOME_SECTIONS, v);
