/** server.ts — ponto de entrada: abre a porta HTTP. Arranque: `npm run dev`. */
import { app } from "./app.js";
import { env } from "./config/env.js";
import { drainJobs } from "./utils/jobQueue.js";

const server = app.listen(env.PORT, () => {
  console.log(`API NhongaExpress a correr em http://localhost:${env.PORT}/api (${env.NODE_ENV})`);
});

// Encerramento limpo: deixa terminar os e-mails em curso antes de sair.
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    server.close();
    drainJobs().finally(() => process.exit(0));
  });
}
