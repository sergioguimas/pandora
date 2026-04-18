export type AIProvider = "gemini" | "openai";

export type AgentGenerationInput = {
  provider: AIProvider;
  model: string;
  temperature: number;
  maxHistoryMessages: number;
  agentName: string;
  agentDescription: string | null;
  agentPromptBase: string;
  latestUserMessage: string;
  history: Array<{
    role: "user" | "assistant" | "system";
    content: string | null;
  }>;
};

export type AgentGenerationResult = {
  text: string;
  provider: AIProvider;
  model: string;
};