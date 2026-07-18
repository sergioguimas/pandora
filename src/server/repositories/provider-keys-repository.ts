import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  decryptProviderKey,
  encryptProviderKey,
  lastFour,
} from "@/server/services/crypto/provider-key-cipher";
import type {
  KeyMode,
  Provider,
  TenantApiKeys,
  TenantKeyResolution,
} from "@/lib/provider-keys";

// Reexporta os tipos/lógica puros para quem já importava daqui.
export {
  resolveApiKeyForProvider,
  type KeyMode,
  type Provider,
  type TenantApiKeys,
  type TenantKeyResolution,
} from "@/lib/provider-keys";

// Acesso à chave de API por tenant (PD-26). Client admin (service_role) porque a
// tabela é fail-closed: não há policy nenhuma, nem para o dono. A autorização
// mora na action que chama isto (owner/admin da própria org) — aqui é só a
// mecânica de cifrar e persistir.

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

// ---------------------------------------------------------------------------
// Leitura para o MOTOR (PD-26). Este é o único ponto que decifra: a chave em
// claro só existe em memória, no instante da chamada ao provedor.
// ---------------------------------------------------------------------------

/** As chaves decifradas de uma org, por provider. Uma chave que não decifra
 *  (segredo trocado, dado corrompido) é IGNORADA — a org cai na chave da
 *  plataforma em vez de o chat inteiro quebrar. */
export async function getDecryptedProviderKeys(
  organizationId: string
): Promise<TenantApiKeys> {
  const { data, error } = await supabaseAdmin
    .from("organization_provider_keys")
    .select("provider, chave_cifrada")
    .eq("organization_id", organizationId);

  if (error) throw new Error("Erro ao carregar chaves da organização.");

  const out: TenantApiKeys = {};
  for (const row of data ?? []) {
    try {
      out[row.provider as Provider] = decryptProviderKey(row.chave_cifrada as string);
    } catch {
      // Não derruba a geração — só perde o BYOK desta chave até ser regravada.
      console.error(
        `Falha ao decifrar a chave ${row.provider} da org ${organizationId}. ` +
          `Verifique PROVIDER_KEY_SECRET. Caindo na chave da plataforma.`
      );
    }
  }
  return out;
}

/** Resolve as chaves do tenant a partir da CONVERSA — a org da conversa é quem
 *  usa o produto (o tenant), então é a fatura dela. Um agente universal (org do
 *  sistema, sem chave) numa conversa do tenant roda com a chave DO TENANT.
 *  Devolve também o `keyMode` da org, para o motor aplicar o enforcement. */
export async function getTenantApiKeysForConversation(
  conversationId: string
): Promise<TenantKeyResolution> {
  const { data, error } = await supabaseAdmin
    .from("conversations")
    .select("organization_id")
    .eq("id", conversationId)
    .maybeSingle();

  if (error) throw new Error("Erro ao resolver a organização da conversa.");
  if (!data?.organization_id) return { keyMode: "platform", keys: {} };

  const organizationId = data.organization_id as string;

  const { data: org, error: orgErr } = await supabaseAdmin
    .from("organizations")
    .select("key_mode")
    .eq("id", organizationId)
    .maybeSingle();

  if (orgErr) throw new Error("Erro ao resolver o modo de chave da organização.");

  const keyMode: KeyMode = org?.key_mode === "own" ? "own" : "platform";
  const keys = await getDecryptedProviderKeys(organizationId);

  return { keyMode, keys };
}

/** true se a org tem chave cadastrada para o provider. Usado para validar, no
 *  save do agente, que um agente 'openai' só é aceito com a chave OpenAI (#4). */
export async function orgHasProviderKey(
  organizationId: string,
  provider: Provider
): Promise<boolean> {
  const { count, error } = await supabaseAdmin
    .from("organization_provider_keys")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("provider", provider);

  if (error) throw new Error("Erro ao verificar chave do provider.");
  return (count ?? 0) > 0;
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
