import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const email = process.argv[2]?.trim().toLowerCase();
const password = process.argv[3];
if (!email || !password || password.length < 8) {
  console.error("Uso: npm run admin:create -- admin@exemplo.com PalavraPasseSegura");
  process.exit(1);
}

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios no backend/.env");

const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
let user;
const created = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
if (created.error) {
  if (!/already registered|already exists/i.test(created.error.message)) throw created.error;
  const list = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (list.error) throw list.error;
  user = list.data.users.find((u) => u.email?.toLowerCase() === email);
  if (!user) throw new Error("A conta já existe, mas não foi encontrada na lista de utilizadores.");
  const updated = await supabase.auth.admin.updateUserById(user.id, { password, email_confirm: true });
  if (updated.error) throw updated.error;
  user = updated.data.user;
} else user = created.data.user;

const { error } = await supabase.from("admin_users").upsert({ user_id: user.id, role: "admin", active: true });
if (error) throw error;
console.log(`Administrador criado/atualizado: ${email}`);
console.log("O login do painel agora é feito pelo Supabase Auth.");
