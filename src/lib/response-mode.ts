// Preset de tamanho da resposta, por agente (`agents.modo_resposta`).
//
// Fica em `lib/` — e não no runtime de IA — porque é consumido tanto pelo
// servidor quanto pelo editor de agentes (client component). O `runtime.ts`
// importa o client Supabase de servidor (`next/headers`), então importá-lo do
// cliente quebraria o bundle.
//
// Módulo puro: sem I/O, sem dependência de framework. Ver PD-10.

export const RESPONSE_MODES = ["leve", "medio", "alto"] as const;

export type ResponseMode = (typeof RESPONSE_MODES)[number];

export const DEFAULT_RESPONSE_MODE: ResponseMode = "medio";

/**
 * Teto de `maxOutputTokens` por modo.
 *
 * `medio` = 2000 reproduz exatamente o teto global anterior — nada muda até o
 * agente optar por outro modo. `alto` fica abaixo do limite de saída do
 * gemini-2.0-flash (8192), o modelo de fallback da síntese.
 */
export const RESPONSE_MODE_MAX_TOKENS: Record<ResponseMode, number> = {
  leve: 800,
  medio: 2000,
  alto: 8000,
};

export const RESPONSE_MODE_LABELS: Record<ResponseMode, string> = {
  leve: "Leve — respostas diretas, menor custo",
  medio: "Médio — equilíbrio (padrão)",
  alto: "Alto — tabelas e comparativos longos",
};

export function isResponseMode(value: unknown): value is ResponseMode {
  return (
    typeof value === "string" && (RESPONSE_MODES as readonly string[]).includes(value)
  );
}

/** Teto de tokens do modo. Valor desconhecido/ausente cai no padrão. */
export function maxOutputTokensFor(mode?: string | null): number {
  return RESPONSE_MODE_MAX_TOKENS[
    isResponseMode(mode) ? mode : DEFAULT_RESPONSE_MODE
  ];
}
