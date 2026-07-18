// Tipos e lógica PURA das chaves por tenant (PD-26/27). Sem `server-only`, sem
// client de banco — por isso pode ser importado pelo orquestrador, que é
// exercitado pelos testes (vitest). O acesso ao banco (cifra, leitura) fica em
// `server/repositories/provider-keys-repository`, que reexporta estes tipos.

export type Provider = "gemini" | "openai";

export type TenantApiKeys = Partial<Record<Provider, string>>;

export type KeyMode = "platform" | "own";

/** O que o motor precisa saber para escolher a chave de um request. */
export type TenantKeyResolution = {
  keyMode: KeyMode;
  keys: TenantApiKeys;
};

/**
 * Resolve a chave a usar para um provider, aplicando o modo da org (PD-27).
 *  - 'platform': sempre a chave da plataforma (retorna undefined).
 *  - 'own': a chave do tenant; se não houver para este provider, LANÇA — a org
 *    optou por trazer a própria e não cadastrou, então não pode rodar na conta
 *    da plataforma em silêncio. O erro é claro e não-retryável.
 */
export function resolveApiKeyForProvider(
  resolution: TenantKeyResolution,
  provider: string
): string | undefined {
  if (resolution.keyMode !== "own") return undefined;

  const key = resolution.keys[provider as Provider];
  if (!key) {
    throw new Error(
      `Esta organização está configurada para usar a própria chave de API, mas ` +
        `nenhuma chave de ${provider} foi cadastrada. Configure em ` +
        `Configurações → Chaves de API.`
    );
  }
  return key;
}
