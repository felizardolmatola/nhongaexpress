/**
 * app.ts — monta a aplicação Express e as proteções de segurança globais.
 * (Separado do server.ts para ser fácil de testar sem abrir uma porta.)
 */
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "./config/env.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";
import { apiLimiter } from "./middleware/rateLimit.js";
import { apiRouter } from "./routes/index.js";

export const app = express();

app.disable("x-powered-by");                 // não anunciar a tecnologia usada
app.set("trust proxy", env.TRUST_PROXY);     // IP real do cliente atrás de proxy (rate limit)

app.use(helmet());                           // cabeçalhos HTTP de segurança
app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true })); // só o nosso frontend, com cookies
app.use(apiLimiter);                         // limite geral de pedidos por IP
app.use(express.json({ limit: "10kb" }));    // corpo JSON pequeno: trava abusos
app.use(cookieParser());

app.use("/api", apiRouter);

app.use(notFound);
app.use(errorHandler);
