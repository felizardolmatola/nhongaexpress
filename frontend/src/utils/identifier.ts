/**
 * utils/identifier.ts — o formulário tem um único campo "E-mail ou telefone".
 * Aqui decidimos qual dos dois é e normalizamos o valor, para que
 * "84 123 4567", "+258841234567" e "841234567" sejam a MESMA conta.
 */
import { z } from "zod";

export type Identifier = { kind: "email"; value: string } | { kind: "phone"; value: string };

const emailSchema = z.string().email().max(254);

/** Telefone móvel de Moçambique: prefixos 82–87 + 7 dígitos (com ou sem +258). */
const normalizePhone = (raw: string): string | null => {
  let digits = raw.replace(/[\s().-]/g, "");
  if (digits.startsWith("+258")) digits = digits.slice(4);
  else if (digits.startsWith("00258")) digits = digits.slice(5);
  else if (digits.startsWith("258") && digits.length === 12) digits = digits.slice(3);
  return /^8[2-7]\d{7}$/.test(digits) ? `+258${digits}` : null;
};

/** Valida e normaliza só um e-mail (minúsculas). Devolve `null` se for inválido. */
export const parseEmail = (raw: string): string | null => {
  const email = raw.trim().toLowerCase();
  return emailSchema.safeParse(email).success ? email : null;
};

/** Valida e normaliza só um telefone (+258XXXXXXXXX). Devolve `null` se for inválido. */
export const parsePhone = (raw: string): string | null => normalizePhone(raw.trim());

/** Devolve o identificador normalizado ou `null` se não for e-mail nem telefone válido. */
export const parseIdentifier = (raw: string): Identifier | null => {
  const value = raw.trim();
  if (value.includes("@")) {
    const email = value.toLowerCase();
    return emailSchema.safeParse(email).success ? { kind: "email", value: email } : null;
  }
  const phone = normalizePhone(value);
  return phone ? { kind: "phone", value: phone } : null;
};
