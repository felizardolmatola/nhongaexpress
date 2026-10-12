/**
 * config/supabase.ts — cliente da base de dados (Supabase / PostgreSQL).
 * Usa a chave service_role, por isso só pode existir no backend. Como não há
 * sessão de utilizador do Supabase (a autenticação é feita por JWT próprio),
 * desligamos a persistência de sessão.
 */
import { createClient } from "@supabase/supabase-js";
import { env } from "./env.js";

export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
