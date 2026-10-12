/**
 * repositories/users.repository.ts — ÚNICO sítio que fala com a tabela `users`.
 * Se um dia mudarmos de base de dados, só este ficheiro muda.
 * `PUBLIC_COLUMNS` garante que o hash da palavra-passe nunca sai por engano.
 */
import { supabase } from "../config/supabase.js";
import { HttpError } from "../utils/httpError.js";

const PUBLIC_COLUMNS = "id, name, email, phone, role, created_at";

/** "customer" = cliente da loja; "admin" = pode entrar no painel administrativo (mesmo login da loja). */
export type Role = "customer" | "admin";

type UserRow = { id: string; name: string; email: string | null; phone: string | null; role: Role; created_at: string };
export type PublicUser = { id: string; name: string; email: string | null; phone: string | null; role: Role; createdAt: string };
/** Contas criadas só com Google não têm palavra-passe (passwordHash = null). */
export type UserWithHash = PublicUser & { passwordHash: string | null };

const toPublic = (r: UserRow): PublicUser => ({
  id: r.id, name: r.name, email: r.email, phone: r.phone, role: r.role, createdAt: r.created_at,
});

/** Erros inesperados da base de dados: não expor detalhes ao cliente. */
const dbFail = (error: { message: string }): never => {
  console.error("[db]", error.message);
  throw new HttpError(500, "Erro interno. Tente novamente mais tarde.");
};

export const usersRepository = {
  async create(data: { name: string; email: string | null; phone: string | null; passwordHash: string | null; role?: Role }): Promise<PublicUser> {
    const { data: row, error } = await supabase
      .from("users")
      .insert({ name: data.name, email: data.email, phone: data.phone, password_hash: data.passwordHash, role: data.role ?? "customer" })
      .select(PUBLIC_COLUMNS)
      .single();
    if (error) {
      // 23505 = violação de unicidade: o nome do índice (users_email_unique / users_phone_unique) diz que campo colidiu.
      if (error.code === "23505") {
        const field = error.message.includes("phone") ? "phone" : "email";
        const label = field === "phone" ? "telefone" : "e-mail";
        throw new HttpError(409, `Já existe uma conta com este ${label}.`, { [field]: `Este ${label} já está em uso.` });
      }
      dbFail(error);
    }
    return toPublic(row as UserRow);
  },

  /** Usado no login: devolve também o hash para comparar a palavra-passe. */
  async findForLogin(kind: "email" | "phone", value: string): Promise<UserWithHash | null> {
    const { data, error } = await supabase
      .from("users")
      .select(`${PUBLIC_COLUMNS}, password_hash`)
      .eq(kind, value)
      .maybeSingle();
    if (error) dbFail(error);
    if (!data) return null;
    const row = data as UserRow & { password_hash: string | null };
    return { ...toPublic(row), passwordHash: row.password_hash };
  },

  /** Atualiza os dados editáveis do perfil. Devolve o utilizador já atualizado. */
  async update(id: string, data: { name: string; email: string | null; phone: string | null }): Promise<PublicUser> {
    const { data: row, error } = await supabase
      .from("users")
      .update({ name: data.name, email: data.email, phone: data.phone })
      .eq("id", id)
      .select(PUBLIC_COLUMNS)
      .single();
    if (error) {
      if (error.code === "23505") {
        // O nome do índice único diz-nos que campo colidiu (users_email_unique / users_phone_unique).
        const field = error.message.includes("phone") ? "phone" : "email";
        const label = field === "phone" ? "telefone" : "e-mail";
        throw new HttpError(409, `Já existe uma conta com este ${label}.`, { [field]: `Este ${label} já está em uso.` });
      }
      dbFail(error);
    }
    return toPublic(row as UserRow);
  },

  /**
   * Só devolve o hash (para confirmar a palavra-passe atual). Nunca sai do servidor.
   * `null` = a conta não existe; `{ passwordHash: null }` = conta só de Google (sem palavra-passe).
   */
  async findHashById(id: string): Promise<{ passwordHash: string | null } | null> {
    const { data, error } = await supabase.from("users").select("password_hash").eq("id", id).maybeSingle();
    if (error) dbFail(error);
    return data ? { passwordHash: (data as { password_hash: string | null }).password_hash } : null;
  },

  async updatePasswordHash(id: string, passwordHash: string): Promise<void> {
    const { error } = await supabase.from("users").update({ password_hash: passwordHash }).eq("id", id);
    if (error) dbFail(error);
  },

  /** Procura uma conta pelo e-mail ou telefone (já normalizado). Sem hash. */
  async findByIdentifier(kind: "email" | "phone", value: string): Promise<PublicUser | null> {
    const { data, error } = await supabase.from("users").select(PUBLIC_COLUMNS).eq(kind, value).maybeSingle();
    if (error) dbFail(error);
    return data ? toPublic(data as UserRow) : null;
  },

  /** Conta já associada a este utilizador Google (login com Google repetido). */
  async findByGoogleId(googleId: string): Promise<PublicUser | null> {
    const { data, error } = await supabase.from("users").select(PUBLIC_COLUMNS).eq("google_id", googleId).maybeSingle();
    if (error) dbFail(error);
    return data ? toPublic(data as UserRow) : null;
  },

  /** Cria uma conta nova vinda do Google: sem palavra-passe e sem telefone. */
  async createWithGoogle(data: { name: string; email: string; googleId: string }): Promise<PublicUser> {
    const { data: row, error } = await supabase
      .from("users")
      .insert({ name: data.name, email: data.email, phone: null, password_hash: null, role: "customer", google_id: data.googleId })
      .select(PUBLIC_COLUMNS)
      .single();
    if (error) {
      if (error.code === "23505") throw new HttpError(409, "Já existe uma conta com este e-mail.", { email: "Este e-mail já está em uso." });
      dbFail(error);
    }
    return toPublic(row as UserRow);
  },

  /**
   * Associa o Google a uma conta existente (mesmo e-mail verificado) e APAGA a palavra-passe dela.
   * Porquê apagar: o registo normal não verifica o e-mail, por isso a palavra-passe pode ter sido
   * definida por outra pessoa antes do dono real entrar com Google. Quem quiser palavra-passe
   * volta a definir uma em "Esqueceu a palavra-passe?" (o código vai para o e-mail da conta).
   * Só liga se a conta ainda não tiver outro Google associado (devolve `null` nesse caso).
   */
  async linkGoogle(id: string, googleId: string): Promise<PublicUser | null> {
    const { data, error } = await supabase
      .from("users")
      .update({ google_id: googleId, password_hash: null })
      .eq("id", id)
      .is("google_id", null)
      .select(PUBLIC_COLUMNS)
      .maybeSingle();
    if (error) dbFail(error);
    return data ? toPublic(data as UserRow) : null;
  },

  /** Muda a função da conta. Só é chamado por scripts/make-admin.ts — nunca por pedidos HTTP. */
  async setRole(id: string, role: Role): Promise<void> {
    const { error } = await supabase.from("users").update({ role }).eq("id", id);
    if (error) dbFail(error);
  },

  /**
   * Estado das sessões da conta: `null` = a conta já não existe; `validAfter` = instante a partir do qual
   * os tokens são aceites (tokens emitidos antes são recusados). `null` = nunca houve revogação.
   * Coluna `users.sessions_valid_after` (ver database/security-hardening.sql).
   */
  async getSessionState(id: string): Promise<{ validAfter: Date | null } | null> {
    const { data, error } = await supabase.from("users").select("sessions_valid_after").eq("id", id).maybeSingle();
    if (error) dbFail(error);
    if (!data) return null;
    const v = (data as { sessions_valid_after: string | null }).sessions_valid_after;
    return { validAfter: v ? new Date(v) : null };
  },

  /**
   * Termina TODAS as sessões abertas da conta (em todos os dispositivos): os tokens emitidos até agora
   * passam a ser recusados. Usa a hora do servidor da API (a mesma que assina os tokens), não a da base de dados.
   */
  async revokeSessions(id: string): Promise<void> {
    const { error } = await supabase.from("users").update({ sessions_valid_after: new Date().toISOString() }).eq("id", id);
    if (error) dbFail(error);
  },

  async findById(id: string): Promise<PublicUser | null> {
    const { data, error } = await supabase.from("users").select(PUBLIC_COLUMNS).eq("id", id).maybeSingle();
    if (error) dbFail(error);
    return data ? toPublic(data as UserRow) : null;
  },

  /** E-mails das contas administradoras (destinatários por omissão dos avisos). */
  async listAdminEmails(): Promise<string[]> {
    const { data, error } = await supabase.from("users").select("email").eq("role", "admin");
    if (error) dbFail(error);
    return (data ?? []).map((r: { email: string | null }) => r.email).filter((e): e is string => Boolean(e));
  },
};
