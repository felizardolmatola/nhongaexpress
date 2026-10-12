import "express-serve-static-core";
declare module "express-serve-static-core" {
  interface Request {
    /** Id do utilizador autenticado (definido pelo middleware `requireAuth`). */
    userId?: string;
    /** Dados do administrador autenticado (definido por `requireAdmin`). */
    admin?: { id: string; name: string; email: string | null; phone: string | null; role: "admin" };
  }
}
