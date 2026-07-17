import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  encryptProviderKey,
  lastFour,
} from "@/server/services/crypto/provider-key-cipher";

// Acesso à chave de API por tenant (PD-26). Client admin (service_role) porque a
// tabela é fail-closed: não há policy nenhuma, nem para o dono. A autorização
// mora na action que chama isto (owner/admin da própria org) — aqui é só a
// mecânica de cifrar e persistir.

export type Provider = "gemini" | "openai";

/** O que a UI pode ver: NUNCA a chave, só provider e os 4 últimos. */
export type ProviderKeyView = {
  provider: Provider;
  ultimos4: string;
  atualizadaEm: string;
};

export async function listProviderKeysForOrg(
  organizationId: string
): Promise<ProviderKeyView[]> {
  const { data, error } = await supabaseAdmin
    .from("organization_provider_keys")
    // `chave_cifrada` fica de fora de propósito: não há motivo de ela sequer sair
    // do banco para a camada de exibição.
    .select("provider, ultimos_4, updated_at")
    .eq("organization_id", organizationId)
    .order("provider");

  if (error) throw new Error("Erro ao listar chaves da organização.");

  return (data ?? []).map((row) => ({
    provider: row.provider as Provider,
    ultimos4: row.ultimos_4 as string,
    atualizadaEm: row.updated_at as string,
  }));
}

/** Grava (ou substitui) a chave de um provider. Cifra na entrada; o valor em
 *  claro não sobrevive a esta função. */
export async function upsertProviderKey(
  organizationId: string,
  provider: Provider,
  plaintextKey: string,
  criadoPor: string
): Promise<void> {
  const chave = plaintextKey.trim();
  if (!chave) throw new Error("Chave vazia.");

  const { error } = await supabaseAdmin
    .from("organization_provider_keys")
    .upsert(
      {
        organization_id: organizationId,
        provider,
        chave_cifrada: encryptProviderKey(chave),
        ultimos_4: lastFour(chave),
        criado_por: criadoPor,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,provider" }
    );

  if (error) throw new Error("Erro ao salvar a chave.");
}

export async function deleteProviderKey(
  organizationId: string,
  provider: Provider
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("organization_provider_keys")
    .delete()
    .eq("organization_id", organizationId)
    .eq("provider", provider);

  if (error) throw new Error("Erro ao remover a chave.");
}
