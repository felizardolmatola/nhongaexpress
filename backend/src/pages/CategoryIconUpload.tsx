/**
 * CategoryIconUpload.tsx — o administrador escolhe a imagem do ícone de uma categoria.
 * Envia o ficheiro para POST /api/admin/uploads (mesma rota das fotos dos produtos) e devolve o URL
 * por `onChange`; esse URL vai no campo `iconUrl` de POST/PATCH /api/admin/categories.
 *
 * Uso no formulário de categoria do painel:
 *   <CategoryIconUpload value={form.iconUrl} onChange={(url) => setForm({ ...form, iconUrl: url })} />
 */
import { useRef, useState } from "react";

const BASE = import.meta.env.VITE_API_URL ?? "";
const TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];

export default function CategoryIconUpload({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function pick(file?: File) {
    if (!file) return;
    setError("");
    if (!TYPES.includes(file.type)) return setError("Use uma imagem JPG, PNG, WebP ou AVIF.");
    if (file.size > 1024 * 1024) return setError("O ícone deve ter no máximo 1 MB.");
    setBusy(true);
    try {
      const res = await fetch(`${BASE}/api/admin/uploads`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": file.type },
        body: file,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message ?? "Não foi possível enviar a imagem.");
      onChange(data.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível enviar a imagem.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <span style={{ width: 56, height: 56, borderRadius: 12, border: "1px dashed #ccc", display: "grid", placeItems: "center", overflow: "hidden" }}>
        {value ? <img src={value} alt="Ícone da categoria" width={40} height={40} style={{ objectFit: "contain" }} /> : <small>Sem ícone</small>}
      </span>
      <div>
        <input ref={input} type="file" accept={TYPES.join(",")} hidden onChange={(e) => pick(e.target.files?.[0])} />
        <button type="button" disabled={busy} onClick={() => input.current?.click()}>{busy ? "A enviar…" : value ? "Trocar imagem" : "Carregar imagem"}</button>
        {value && <button type="button" disabled={busy} onClick={() => onChange("")} style={{ marginLeft: 8 }}>Remover</button>}
        {error && <div role="alert" style={{ color: "#b00020", fontSize: 13, marginTop: 4 }}>{error}</div>}
      </div>
    </div>
  );
}
