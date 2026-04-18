import type {
  AgentGenerationInput,
  AgentGenerationResult,
} from "@/types/ai";
import { generateWithGemini } from "@/server/services/ai/providers/gemini-provider";

export async function generateAgentResponse(
  input: AgentGenerationInput
): Promise<AgentGenerationResult> {
  switch (input.provider) {
    case "gemini":
      return generateWithGemini(input);

    case "openai":
      throw new Error("Provider OpenAI ainda não implementado.");

    default:
      throw new Error(`Provider não suportado: ${input.provider}`);
  }
}