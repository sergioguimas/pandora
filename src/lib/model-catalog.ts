// Catálogo de modelos por provider (#4). Puro — usado pelo picker do editor e
// pela validação no servidor. Lista curada: só modelos que o motor sabe gerar.
// Ao somar um modelo, garanta que o id é EXATO (id inválido → erro na API).

import type { Provider } from "@/lib/provider-keys";

export type ModelOption = { id: string; label: string };

export const MODEL_CATALOG: Record<Provider, ModelOption[]> = {
  gemini: [
    { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash (rápido, padrão)" },
    { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro (mais capaz)" },
    { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
  ],
  openai: [
    { id: "gpt-4o", label: "GPT-4o" },
    { id: "gpt-4o-mini", label: "GPT-4o mini (rápido)" },
  ],
};

export function modelsFor(provider: string): ModelOption[] {
  return MODEL_CATALOG[provider as Provider] ?? [];
}

/** true se `model` é um id conhecido para `provider`. Barra combinações inválidas
 *  no servidor (o cliente pode ser burlado). */
export function isValidModel(provider: string, model: string): boolean {
  return modelsFor(provider).some((m) => m.id === model);
}
