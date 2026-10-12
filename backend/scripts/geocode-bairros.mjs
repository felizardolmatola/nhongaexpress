// Procura no OpenStreetMap (Nominatim) o centro de cada bairro da Beira e gera SQL + CSV para REVISÃO.
// Uso (Node 18+):  node scripts/geocode-bairros.mjs
// Cria: bairros-coordenadas.sql  e  bairros-coordenadas.csv  (na pasta onde executar).
// Depois abra o CSV, confira cada ponto no Google Maps (colar "lat,lon" na pesquisa) e só então corra o SQL no Supabase.
import { writeFileSync } from "node:fs";

const BAIRROS = ["Chaimite","Chipangara","Esturro","Macurungo","Macuti","Matacuane","Pioneiros","Ponta-Gêa","Chota","Mananga","Maraza","Munhava-Central","Vaz","Alto da Manga","Chingussura","Inhamízua","Matadouro","Nhaconjo","Vila Massane","Manga Mascarenhas","Muave","Mungassa","Ndunda","Nhangau","Nhangoma","Tchonja"];
// Caixa à volta do município da Beira (esquerda,topo,direita,fundo) para não aceitar homónimos de outras zonas.
const VIEWBOX = "34.70,-19.70,35.00,-20.00";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rows = [];

for (const nome of BAIRROS) {
  const q = new URLSearchParams({ q: `${nome.replace("-", " ")}, Beira, Moçambique`, format: "json", limit: "1", viewbox: VIEWBOX, bounded: "1" });
  let lat = null, lon = null, tipo = "";
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${q}`, { headers: { "User-Agent": "nhongaexpress-geocode/1.0 (felizardolmatola@gmail.com)" } });
    const json = await res.json();
    if (json[0]) { lat = Number(Number(json[0].lat).toFixed(5)); lon = Number(Number(json[0].lon).toFixed(5)); tipo = json[0].type ?? ""; }
  } catch (e) { tipo = `erro: ${e.message}`; }
  rows.push({ nome, lat, lon, tipo });
  console.log(lat === null ? `✗ ${nome} — não encontrado (preencher à mão)` : `✓ ${nome}: ${lat}, ${lon} (${tipo})`);
  await sleep(1200); // Nominatim: máx. 1 pedido por segundo
}

const esc = (s) => s.replace(/'/g, "''");
const sql = ["-- REVER no Google Maps antes de executar. Bairros sem ponto ficam de fora.",
  ...rows.filter((r) => r.lat !== null).map((r) => `update public.delivery_zones set latitude = ${r.lat}, longitude = ${r.lon}, updated_at = now() where neighborhood = '${esc(r.nome)}';`)].join("\n") + "\n";
writeFileSync("bairros-coordenadas.sql", sql);
writeFileSync("bairros-coordenadas.csv", "bairro,latitude,longitude,tipo_osm\n" + rows.map((r) => `${r.nome},${r.lat ?? ""},${r.lon ?? ""},${r.tipo}`).join("\n") + "\n");
console.log("\nGerados: bairros-coordenadas.sql e bairros-coordenadas.csv");
