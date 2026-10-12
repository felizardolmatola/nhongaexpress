/**
 * scripts/make-admin.ts — dá (ou tira) acesso ao painel a uma conta da loja.
 * O administrador entra pelo MESMO login dos clientes; aqui só se muda a função da conta.
 *
 * Uso (na pasta backend):
 *   npm run admin:promote -- felizardo@exemplo.com              torna uma conta existente em administrador
 *   npm run admin:promote -- "84 123 4567"                      (também funciona com telefone, entre aspas)
 *   npm run admin:promote -- novo@exemplo.com "Nome" "Senha123" cria a conta já como administrador
 *   npm run admin:promote -- felizardo@exemplo.com --remove     volta a ser cliente
 */
import bcrypt from "bcryptjs";
import { usersRepository } from "../src/repositories/users.repository.js";
import { parseIdentifier } from "../src/utils/identifier.js";

const args = process.argv.slice(2);
const remove = args.includes("--remove");
const rest = args.filter((a) => a !== "--remove");

const [rawId = "", name, password] = rest;
const id = parseIdentifier(rawId);
if (!id) {
  console.error('Indique o e-mail ou telefone da conta (telefone entre aspas). Ex.: npm run admin:promote -- felizardo@exemplo.com');
  process.exit(1);
}

try {
  const existing = await usersRepository.findByIdentifier(id.kind, id.value);

  if (existing) {
    await usersRepository.setRole(existing.id, remove ? "customer" : "admin");
    console.log(remove ? `${existing.name} voltou a ser cliente.` : `${existing.name} agora é administrador. Entre pelo login normal da loja.`);
  } else if (remove) {
    console.error("Não existe nenhuma conta com esse e-mail/telefone.");
    process.exit(1);
  } else if (name && password) {
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      console.error("A palavra-passe precisa de 8+ caracteres, com letras e pelo menos um número.");
      process.exit(1);
    }
    await usersRepository.create({
      name,
      email: id.kind === "email" ? id.value : null,
      phone: id.kind === "phone" ? id.value : null,
      passwordHash: await bcrypt.hash(password, 12),
      role: "admin",
    });
    console.log(`Conta criada e já é administrador: ${id.value}`);
  } else {
    console.error("Essa conta ainda não existe. Registe-se primeiro na loja, ou crie-a já como administrador:");
    console.error('  npm run admin:promote -- novo@exemplo.com "Nome Completo" "UmaSenha123"');
    process.exit(1);
  }
} catch (error) {
  console.error("Falhou:", error instanceof Error ? error.message : error);
  process.exit(1);
}
process.exit(0);
