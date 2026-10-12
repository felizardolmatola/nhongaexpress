/**
 * repositories/productImages.repository.ts — guarda as fotos dos produtos no Supabase Storage.
 * O upload é feito pelo backend (chave service_role), por isso o navegador nunca precisa
 * de uma sessão do Supabase: a única sessão é a da loja.
 */
import { randomUUID } from "node:crypto";
import { supabase } from "../config/supabase.js";
import { HttpError } from "../utils/httpError.js";
import type { ImageKind } from "../utils/image.js";

const BUCKET = "product-images";

export const productImagesRepository = {
  /** Envia a imagem e devolve o URL público (é este URL que fica guardado no produto). */
  async upload(file: Buffer, kind: ImageKind): Promise<string> {
    const path = `${randomUUID()}.${kind.ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
      contentType: kind.type,
      cacheControl: "31536000",
      upsert: false,
    });
    if (error) {
      console.error("[storage]", error.message);
      throw new HttpError(500, "Não foi possível guardar a imagem. Tente novamente.");
    }
    return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  },
};
