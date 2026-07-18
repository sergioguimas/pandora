import OpenAI from "openai";
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
export const IMPLEMENTED_PROVIDERS: readonly AgentProvider[] = ["gemini", "openai"];

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
  // Chave do tenant (PD-26). Ausente = usa a chave da plataforma. Resolvida uma
  // vez por request, a partir da organização da conversa.
  apiKey?: string;
};

export type ModelStream = AsyncIterable<{ text?: string }>;

export function isImplementedProvider(value: unknown): value is AgentProvider {
  return (
    typeof value === "string" &&
    (IMPLEMENTED_PROVIDERS as readonly string[]).includes(value)
  );
}

async function streamWithGemini(params: ModelStreamParams): Promise<ModelStream> {
  const ai = getGeminiClient(params.apiKey);

  return ai.models.generateContentStream({
    model: params.model,
    contents: params.contents,
    config: {
      temperature: params.temperature,
      maxOutputTokens: params.maxOutputTokens,
    },
  });
}

async function streamWithOpenAI(params: ModelStreamParams): Promise<ModelStream> {
  // OpenAI SÓ funciona com a chave própria da org (PD-26/#4): a plataforma não
  // tem chave OpenAI. Sem `apiKey` aqui, falha alto com mensagem clara em vez de
  // um erro genérico do SDK. (Em modo 'own' sem a chave, o enforcement já barra
  // antes; isto cobre um agente 'openai' numa org modo 'platform'.)
  if (!params.apiKey) {
    throw new Error(
      "O provider OpenAI requer a chave de API própria da organização. " +
        "Cadastre-a em Configurações → Chaves de API."
    );
  }

  const client = new OpenAI({ apiKey: params.apiKey });

  // `contents` é o formato do Gemini ({ role, parts:[{text}] }). Traduz para o
  // do OpenAI ({ role, content }): 'model' vira 'assistant'; o texto dos parts é
  // concatenado. A instrução de sistema já vem embutida como o primeiro turno.
  const messages = params.contents.map((turn) => ({
    role: (turn.role === "model" ? "assistant" : "user") as "assistant" | "user",
    content: turn.parts.map((p) => p.text).join(""),
  }));

  const stream = await client.chat.completions.create({
    model: params.model,
    messages,
    temperature: params.temperature,
    max_tokens: params.maxOutputTokens,
    stream: true,
  });

  // Adapta o stream do OpenAI ao contrato ModelStream (AsyncIterable<{text?}>).
  return (async function* () {
    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content ?? "";
      if (text) yield { text };
    }
  })();
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

    case "openai":
      return streamWithOpenAI(params);

    default:
      throw new Error(
        `Provider "${params.provider}" ainda não implementado. ` +
          `Disponíveis: ${IMPLEMENTED_PROVIDERS.join(", ")}.`
      );
  }
}
