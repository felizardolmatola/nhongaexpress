/**
 * services/auth.service.ts — regras de negócio da autenticação (sem HTTP aqui).
 * - Palavras-passe guardadas com bcrypt (custo 12): lento de propósito para
 *   dificultar ataques de força bruta caso a base de dados vaze.
 * - Login com mensagem genérica e comparação feita SEMPRE (mesmo sem conta),
 *   para não revelar por mensagem nem por tempo de resposta se a conta existe.
 */
import bcrypt from "bcryptjs";
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { env } from "../config/env.js";
import { passwordResetsRepository } from "../repositories/passwordResets.repository.js";
import { usersRepository, type PublicUser } from "../repositories/users.repository.js";
import type { GoogleProfile } from "../utils/socialProviders.js";
import { HttpError } from "../utils/httpError.js";
import { parseEmail, parseIdentifier, parsePhone } from "../utils/identifier.js";
import { signToken } from "../utils/jwt.js";
import { sendEmail } from "../utils/notifier.js";
import { adminNotifications } from "./adminNotifications.service.js";

const BCRYPT_COST = 12;
// Hash "de mentira" usado quando a conta não existe (igualiza o tempo de resposta).
const DUMMY_HASH = bcrypt.hashSync("palavra-passe-inexistente", BCRYPT_COST);

/** Converte "7d", "12h", "30m" em milissegundos (para a duração do cookie). */
export const durationToMs = (d: string): number => {
  const m = /^(\d+)([smhd])$/.exec(d);
  if (!m) return 7 * 24 * 3600 * 1000;
  const unit = { s: 1e3, m: 6e4, h: 36e5, d: 864e5 }[m[2] as "s" | "m" | "h" | "d"];
  return Number(m[1]) * unit;
};

/* ---- Recuperação de palavra-passe ---- */
const RESET_TTL_MS = 15 * 60 * 1000;      // o código vale 15 minutos
const RESET_COOLDOWN_MS = 60 * 1000;      // no mínimo 1 minuto entre pedidos (evita spam à vítima)
const RESET_MAX_ATTEMPTS = 5;             // tentativas erradas antes de o código ser anulado

/** HMAC do código com o segredo do servidor: se a tabela vazar, os códigos não se deduzem. */
const hashCode = (userId: string, code: string) => createHmac("sha256", env.JWT_SECRET).update(`${userId}:${code}`).digest("hex");
const sameHash = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export type Session = { user: PublicUser; token: string; maxAgeMs?: number };

/** `remember` = "Manter sessão iniciada": sessão longa + cookie persistente. */
const openSession = (user: PublicUser, remember: boolean): Session => {
  const expiresIn = remember ? env.JWT_EXPIRES_IN : env.JWT_SHORT_EXPIRES_IN;
  return {
    user,
    token: signToken(user.id, expiresIn),
    maxAgeMs: remember ? durationToMs(expiresIn) : undefined,
  };
};

export const authService = {
  /** E-mail obrigatório; telefone opcional. */
  async register(input: { name: string; email: string; phone?: string; password: string }): Promise<Session> {
    const email = parseEmail(input.email);
    const phone = input.phone ? parsePhone(input.phone) : null;
    // (O controlador já validou; esta verificação protege o serviço se for reutilizado.)
    if (!email) throw new HttpError(400, "E-mail inválido.", { email: "E-mail inválido. Use o formato nome@dominio.com." });
    if (input.phone && !phone) throw new HttpError(400, "Telefone inválido.", { phone: "Telefone inválido. Use 8X XXX XXXX." });
    const passwordHash = await bcrypt.hash(input.password, BCRYPT_COST);
    const user = await usersRepository.create({ name: input.name, email, phone, passwordHash });
    adminNotifications.newUser(user, "e-mail e palavra-passe"); // segundo plano: não espera
    return openSession(user, true);
  },

  async login(input: { identifier: string; password: string; remember: boolean }): Promise<Session> {
    const invalid = new HttpError(401, "Credenciais inválidas.");
    const id = parseIdentifier(input.identifier);
    const found = id ? await usersRepository.findForLogin(id.kind, id.value) : null;
    // Compara sempre (mesmo tempo de resposta), mas uma conta sem palavra-passe (Google) nunca entra por aqui.
    const ok = await bcrypt.compare(input.password, found?.passwordHash ?? DUMMY_HASH);
    if (!found || !found.passwordHash || !ok) throw invalid;
    const { passwordHash: _omit, ...user } = found;
    return openSession(user, input.remember);
  },

  /**
   * Login/registo com Google (o token já foi validado em utils/socialProviders.ts).
   * 1) já entrou antes com Google -> abre a sessão;
   * 2) já existe conta com o mesmo e-mail VERIFICADO -> associa o Google a essa conta;
   * 3) senão -> cria uma conta nova (sem palavra-passe).
   */
  async googleLogin(profile: GoogleProfile): Promise<Session> {
    let user = await usersRepository.findByGoogleId(profile.googleId);
    if (!user) {
      const email = profile.email && profile.emailVerified ? parseEmail(profile.email) : null;
      if (!email) {
        throw new HttpError(400, "A sua conta Google não partilhou um e-mail verificado. Crie a conta com e-mail e palavra-passe.");
      }
      const existing = await usersRepository.findByIdentifier("email", email);
      if (existing) {
        user = await usersRepository.linkGoogle(existing.id, profile.googleId);
        if (!user) throw new HttpError(409, "Este e-mail já está associado a outra conta Google.");
        // A palavra-passe foi apagada; as sessões abertas antes (possivelmente de outra pessoa que registou
        // este e-mail primeiro) também têm de acabar. A nova sessão é aberta DEPOIS, por isso fica válida.
        await usersRepository.revokeSessions(existing.id);
      } else {
        const fallback = email.split("@")[0];
        const raw = (profile.name?.trim() || fallback).slice(0, 100);
        user = await usersRepository.createWithGoogle({
          name: raw.length >= 2 ? raw : "Cliente",
          email,
          googleId: profile.googleId,
        });
        adminNotifications.newUser(user, "Google"); // só contas NOVAS (não o login de quem já existia)
      }
    }
    return openSession(user, true);
  },

  async me(userId: string): Promise<PublicUser> {
    const user = await usersRepository.findById(userId);
    if (!user) throw new HttpError(401, "Sessão inválida.");
    return user;
  },

  /**
   * Atualiza nome, e-mail e/ou telefone. Só os campos enviados mudam; enviar "" apaga o telefone.
   * O e-mail é obrigatório (recebe o código de recuperação) e não pode ser apagado.
   */
  async updateProfile(userId: string, input: { name?: string; email?: string; phone?: string }): Promise<PublicUser> {
    const current = await usersRepository.findById(userId);
    if (!current) throw new HttpError(401, "Sessão inválida.");

    if (input.email === "") throw new HttpError(400, "Dados inválidos.", { email: "O e-mail é obrigatório." });
    const email = input.email === undefined ? current.email : parseEmail(input.email);
    const phone = input.phone === undefined ? current.phone : input.phone === "" ? null : parsePhone(input.phone);
    return usersRepository.update(userId, { name: input.name ?? current.name, email, phone });
  },

  /** Confirma a palavra-passe atual antes de aceitar a nova (protege contra sessões esquecidas abertas). */
  async changePassword(userId: string, input: { currentPassword: string; newPassword: string }): Promise<Session> {
    const found = await usersRepository.findHashById(userId);
    if (!found) throw new HttpError(401, "Sessão inválida.");
    // Conta criada com Google: ainda não tem palavra-passe para confirmar.
    if (!found.passwordHash) {
      throw new HttpError(400, "Esta conta não tem palavra-passe.", { currentPassword: "Esta conta entra com Google e não tem palavra-passe. Use \"Esqueceu a palavra-passe?\" para definir uma." });
    }
    const ok = await bcrypt.compare(input.currentPassword, found.passwordHash);
    if (!ok) throw new HttpError(400, "Dados inválidos.", { currentPassword: "Palavra-passe atual incorreta." });
    await usersRepository.updatePasswordHash(userId, await bcrypt.hash(input.newPassword, BCRYPT_COST));
    // Termina as sessões dos outros dispositivos (e de quem possa ter roubado uma) e dá uma sessão nova a este.
    await usersRepository.revokeSessions(userId);
    const user = await usersRepository.findById(userId);
    if (!user) throw new HttpError(401, "Sessão inválida.");
    return openSession(user, true);
  },

  /**
   * Passo 1 da recuperação: gera um código de 6 dígitos e envia-o por E-MAIL.
   * O cliente pode escrever o e-mail ou o telefone; o código vai sempre para o e-mail da conta.
   * NUNCA revela se a conta existe: responde sempre igual e o envio corre em segundo plano.
   */
  async forgotPassword(input: { identifier: string }): Promise<void> {
    const id = parseIdentifier(input.identifier);
    const user = id ? await usersRepository.findByIdentifier(id.kind, id.value) : null;
    if (!id || !user || !user.email) return; // sem conta (ou conta antiga sem e-mail): não há para onde enviar

    const previous = await passwordResetsRepository.find(user.id);
    if (previous && Date.now() - previous.createdAt.getTime() < RESET_COOLDOWN_MS) return;

    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    await passwordResetsRepository.upsert(user.id, hashCode(user.id, code), new Date(Date.now() + RESET_TTL_MS));

    const text = `O seu código de recuperação NhongaExpress é ${code}. Vale 15 minutos. Se não pediu, ignore esta mensagem.`;
    const send = sendEmail(user.email, "NhongaExpress — código de recuperação", `Olá, ${user.name}.\n\n${text}`);
    send.catch((error) => console.error("[notifier] falha no envio do código:", error instanceof Error ? error.message : error));
  },

  /**
   * Passo 2: confirma o código e define a nova palavra-passe. O código é de uso único,
   * expira e é anulado após 5 tentativas erradas. Mensagem única para qualquer falha.
   */
  async resetPassword(input: { identifier: string; code: string; newPassword: string }): Promise<void> {
    const invalid = new HttpError(400, "Dados inválidos.", { code: "Código inválido ou expirado." });
    const id = parseIdentifier(input.identifier);
    const user = id ? await usersRepository.findByIdentifier(id.kind, id.value) : null;
    if (!user) throw invalid;

    const reset = await passwordResetsRepository.find(user.id);
    if (!reset) throw invalid;
    if (reset.expiresAt.getTime() < Date.now() || reset.attempts >= RESET_MAX_ATTEMPTS) {
      await passwordResetsRepository.remove(user.id);
      throw invalid;
    }
    // Conta a tentativa ANTES de comparar: mesmo pedidos em paralelo não passam das 5.
    if (!(await passwordResetsRepository.registerAttempt(user.id, reset.attempts))) throw invalid;
    if (!sameHash(reset.codeHash, hashCode(user.id, input.code))) throw invalid;

    await usersRepository.updatePasswordHash(user.id, await bcrypt.hash(input.newPassword, BCRYPT_COST));
    await usersRepository.revokeSessions(user.id); // quem esqueceu a palavra-passe pode ter a conta comprometida
    await passwordResetsRepository.remove(user.id);
  },
};
