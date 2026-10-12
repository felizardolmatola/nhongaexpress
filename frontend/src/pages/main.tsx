/**
 * main.tsx — ponto de entrada da aplicação.
 * O Vite carrega este ficheiro a partir do index.html. Escolhemos aqui qual das duas
 * apps abrir, conforme o endereço (ver route.ts), e só então carregamos o código dela.
 * O CSS é um só (css/styles.css, com Tailwind); para o painel e a loja não
 * se atrapalharem, marcamos o <body> com `is-admin` quando a página é /admin.
 */

import { createRoot } from "react-dom/client";
import "../css/styles.css";
import { isAdminPath } from "../services/route";

const root = createRoot(document.getElementById("root")!);

if (isAdminPath()) {
  document.body.classList.add("is-admin");
  import("../admin/AdminApp").then((m) => root.render(<m.default />));
} else {
  import("./App").then((m) => root.render(<m.default />));
}
