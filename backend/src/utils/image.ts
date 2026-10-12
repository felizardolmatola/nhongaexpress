/**
 * utils/image.ts — descobre o tipo REAL de uma imagem pelos primeiros bytes.
 * Não confiamos no `Content-Type` nem na extensão enviados pelo cliente: um ficheiro
 * qualquer pode dizer que é "image/png". Só aceitamos o que realmente é imagem.
 */
export type ImageKind = { ext: "jpg" | "png" | "webp" | "avif"; type: string };

export const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];

export const detectImage = (b: Buffer): ImageKind | null => {
  if (b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: "jpg", type: "image/jpeg" };
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { ext: "png", type: "image/png" };
  if (b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") return { ext: "webp", type: "image/webp" };
  if (b.toString("ascii", 4, 8) === "ftyp" && ["avif", "avis"].includes(b.toString("ascii", 8, 12))) return { ext: "avif", type: "image/avif" };
  return null;
};
