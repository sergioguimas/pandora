import { GoogleGenAI } from "@google/genai";

// `apiKey` opcional: quando vem, é a chave do TENANT (PD-26, BYOK); quando não
// vem, cai na chave da PLATAFORMA (`GEMINI_API_KEY`). O ponto que decide qual
// usar é a resolução da chave da org da conversa — aqui só se recebe a decisão.
export function getGeminiClient(apiKey?: string) {
  const key = apiKey ?? process.env.GEMINI_API_KEY;

  if (!key) {
    throw new Error("GEMINI_API_KEY não configurada.");
  }

  return new GoogleGenAI({ apiKey: key });
}
