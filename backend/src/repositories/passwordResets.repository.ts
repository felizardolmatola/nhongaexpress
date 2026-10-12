/**
 * repositories/passwordResets.repository.ts — acesso à tabela `password_resets`
 * (um código de recuperação ativo por utilizador).
 */
import { supabase } from "../config/supabase.js";
import { HttpError } from "../utils/httpError.js";

export type PasswordReset = { userId: string; codeHash: string; expiresAt: Date; attempts: number; createdAt: Date };
type Row = { user_id: string; code_hash: string; expires_at: string; attempts: number; created_at: string };

const dbFail = (error: { message: string }): never => {
  console.error("[db]", error.message);
  throw new HttpError(500, "Erro interno. Tente novamente mais tarde.");
};

export const passwordResetsRepository = {
  /** Cria (ou substitui) o código do utilizador e põe as tentativas a zero. */
  async upsert(userId: string, codeHash: string, expiresAt: Date): Promise<void> {
    const { error } = await supabase.from("password_resets").upsert({
      user_id: userId,
      code_hash: codeHash,
      expires_at: expiresAt.toISOString(),
      attempts: 0,
      created_at: new Date().toISOString(),
    });
    if (error) dbFail(error);
  },

  async find(userId: string): Promise<PasswordReset | null> {
    const { data, error } = await supabase.from("password_resets").select("*").eq("user_id", userId).maybeSingle();
    if (error) dbFail(error);
    if (!data) return null;
    const r = data as Row;
    return { userId: r.user_id, codeHash: r.code_hash, expiresAt: new Date(r.expires_at), attempts: r.attempts, createdAt: new Date(r.created_at) };
  },

  /**
   * Regista uma tentativa. Só conta se `attempts` ainda for o valor lido (concorrência otimista):
   * dois pedidos em paralelo não conseguem "gastar" uma só tentativa. Devolve false se perdeu a corrida.
   */
  async registerAttempt(userId: string, current: number): Promise<boolean> {
    const { data, error } = await supabase
      .from("password_resets")
      .update({ attempts: current + 1 })
      .eq("user_id", userId)
      .eq("attempts", current)
      .select("user_id");
    if (error) dbFail(error);
    return (data?.length ?? 0) > 0;
  },

  async remove(userId: string): Promise<void> {
    const { error } = await supabase.from("password_resets").delete().eq("user_id", userId);
    if (error) dbFail(error);
  },
};
