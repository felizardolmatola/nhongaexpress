/**
 * services/account.service.ts — regras de negócio das moradas e das preferências.
 *
 *  - no máximo 5 moradas por cliente;
 *  - a primeira morada guardada fica logo como padrão;
 *  - ao eliminar a morada padrão, a mais antiga que sobra passa a padrão;
 *  - todas as operações sobre moradas devolvem a lista completa e atualizada (o frontend só a substitui).
 * (O `userId` vem da sessão: um cliente nunca consegue mexer nas moradas de outro.)
 */
import { HttpError } from "../utils/httpError.js";
import { accountRepository, type AddressView, type SettingsView } from "../repositories/account.repository.js";
import { MAX_ADDRESSES, type AddressInput, type SettingsPatch } from "../schemas/account.schema.js";

const NOT_FOUND = () => new HttpError(404, "Morada não encontrada.");

export const accountService = {
  listAddresses: (userId: string): Promise<AddressView[]> => accountRepository.listAddresses(userId),

  async createAddress(userId: string, input: AddressInput): Promise<AddressView[]> {
    const current = await accountRepository.listAddresses(userId);
    if (current.length >= MAX_ADDRESSES) {
      throw new HttpError(409, `Pode guardar até ${MAX_ADDRESSES} moradas. Elimine uma para adicionar outra.`);
    }
    // A primeira morada é sempre a padrão; as outras só se o cliente pedir.
    await accountRepository.insertAddress(userId, input, current.length === 0);
    if (input.makeDefault && current.length > 0) {
      const created = (await accountRepository.listAddresses(userId)).filter((a) => !current.some((c) => c.id === a.id));
      if (created[0]) await accountRepository.setDefault(userId, created[0].id);
    }
    return accountRepository.listAddresses(userId);
  },

  async updateAddress(userId: string, id: string, input: AddressInput): Promise<AddressView[]> {
    if (!(await accountRepository.updateAddress(userId, id, input))) throw NOT_FOUND();
    if (input.makeDefault) await accountRepository.setDefault(userId, id);
    return accountRepository.listAddresses(userId);
  },

  async setDefault(userId: string, id: string): Promise<AddressView[]> {
    await accountRepository.setDefault(userId, id);
    return accountRepository.listAddresses(userId);
  },

  async deleteAddress(userId: string, id: string): Promise<AddressView[]> {
    const before = await accountRepository.listAddresses(userId);
    const target = before.find((a) => a.id === id);
    if (!target) throw NOT_FOUND();
    if (!(await accountRepository.deleteAddress(userId, id))) throw NOT_FOUND();
    // Apagou a padrão? A mais antiga que sobra assume o lugar.
    const rest = before.filter((a) => a.id !== id);
    if (target.isDefault && rest.length > 0) await accountRepository.setDefault(userId, rest[0].id);
    return accountRepository.listAddresses(userId);
  },

  getSettings: (userId: string): Promise<SettingsView> => accountRepository.getSettings(userId),

  async updateSettings(userId: string, patch: SettingsPatch): Promise<SettingsView> {
    await accountRepository.saveSettings(userId, patch);
    return accountRepository.getSettings(userId);
  },
};
