import { getGeminiClient } from "@/lib/gemini/client";
import type {
  AgentGenerationInput,
  AgentGenerationResult,
} from "@/types/ai";

function buildSystemInstruction(input: AgentGenerationInput) {
  return [
    `Você é o agente "${input.agentName}" dentro da plataforma Pandora.`,
    input.agentDescription
      ? `Descrição do agente: ${input.agentDescription}`
      : null,
    `Siga este prompt base com prioridade: ${input.agentPromptBase}`,
    "Responda sempre em português do Brasil.",
    "Seja útil, claro, objetivo e profissional.",
    "Use o histórico como contexto, mas não invente fatos.",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildConversationText(input: AgentGenerationInput) {
  const historyLines = input.history
    .filter((message) => message.content?.trim())
    .slice(-input.maxHistoryMessages)
    .map((message) => {
      const roleLabel =
        message.role === "assistant"
          ? "Agente"
          : message.role === "system"
          ? "Sistema"
          : "Usuário";

      return `${roleLabel}: ${message.content!.trim()}`;
    });

  return [
    "Histórico recente da conversa:",
    ...historyLines,
    "",
    `Usuário: ${input.latestUserMessage}`,
    "",
    "Agora responda como o agente.",
  ].join("\n");
}

export async function generateWithGemini(
  input: AgentGenerationInput
): Promise<AgentGenerationResult> {
  const ai = getGeminiClient();
  const model = input.model || process.env.GEMINI_MODEL || "gemini-2.5-flash";

  const response = await ai.models.generateContent({
    model,
    config: {
      temperature: input.temperature,
      systemInstruction: buildSystemInstruction(input),
    },
    contents: buildConversationText(input),
  });

  const text = response.text?.trim();

  if (!text) {
    throw new Error("O Gemini não retornou texto.");
  }

  return {
    text,
    provider: "gemini",
    model,
  };
}