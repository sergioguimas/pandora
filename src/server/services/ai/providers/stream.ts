import { getGeminiClient } from "@/lib/gemini/client";

// Ponto único de despacho por provider (PD-12).
//
// A coluna `agents.provider` sempre aceitou 'gemini' | 'openai', mas o código
// chamava o Gemini direto e ignorava o campo: marcar um agente como 'openai'
// gerava com Gemini EM SILÊNCIO. Aqui o despacho é explícito e um provider sem
// implementação falha alto, com mensagem clara — em vez de fingir que funcionou.
//
// PARA ADICIONAR UM PROVIDER
//   1. escreva a função de streaming (recebe ModelStreamParams, devolve
//      AsyncIterable de { text } — cada item é um pedaço do texto);
//   2. registre no switch de `streamModel`;
//   3. inclua o nome na constraint `agents_provider_check` (migration) e no tipo
//      `AgentProvider`.
// O resto do sistema (retry, timeout, classificação de erro, SSE) já é agnóstico
// de provider — vive em runtime.ts.

export const AGENT_PROVIDERS = ["gemini", "openai"] as const;

export type AgentProvider = (typeof AGENT_PROVIDERS)[number];

/** Providers com implementação real. Os demais existem só no schema. */
export const IMPLEMENTED_PROVIDERS: readonly AgentProvider[] = ["gemini"];

export type ModelContents = Array<{
  role: "user" | "model";
  parts: Array<{ text: string }>;
}>;

export type ModelStreamParams = {
  provider: string;
  model: string;
  contents: ModelContents;
  temperature: number;
  maxOutputTokens: number;
};

export type ModelStream = AsyncIterable<{ text?: string }>;

export function isImplementedProvider(value: unknown): value is AgentProvider {
  return (
    typeof value === "string" &&
    (IMPLEMENTED_PROVIDERS as readonly string[]).includes(value)
  );
}

async function streamWithGemini(params: ModelStreamParams): Promise<ModelStream> {
  const ai = getGeminiClient();

  return ai.models.generateContentStream({
    model: params.model,
    contents: params.contents,
    config: {
      temperature: params.temperature,
      maxOutputTokens: params.maxOutputTokens,
    },
  });
}

/**
 * Abre o streaming no provider do agente.
 *
 * Provider sem implementação lança erro. `classifyModelError` o trata como
 * MODEL_UNKNOWN_ERROR (não-retryable), então a mensagem chega ao usuário e o
 * botão "tentar novamente" não aparece — reenviar não resolveria.
 */
export async function streamModel(params: ModelStreamParams): Promise<ModelStream> {
  switch (params.provider) {
    case "gemini":
      return streamWithGemini(params);

    default:
      throw new Error(
        `Provider "${params.provider}" ainda não implementado. ` +
          `Disponíveis: ${IMPLEMENTED_PROVIDERS.join(", ")}.`
      );
  }
}
