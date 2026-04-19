export type Agent = {
  id: string;
  slug: string;
  nome: string;
  descricao: string | null;
  avatar_url: string | null;
  prompt_base: string;
  ativo: boolean;
  provider: "gemini" | "openai";
  model: string;
  temperature: number;
  max_history_messages: number;
  created_at: string;
  updated_at: string;
};

export type AgentListItem = Agent & {
  last_message_preview?: string | null;
  last_message_at?: string | null;
  last_conversation_title?: string | null;
  last_conversation_id?: string | null;
};

export type Conversation = {
  id: string;
  user_id: string;
  agent_id: string;
  titulo: string | null;
  created_at: string;
  updated_at: string;
};

export type Message = {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system";
  content: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type ConversationWithAgent = Conversation & {
  agents:
    | {
        id: string;
        slug: string;
        nome: string;
        descricao: string | null;
        prompt_base: string;
        provider: "gemini" | "openai";
        model: string;
        temperature: number;
        max_history_messages: number;
      }
    | {
        id: string;
        slug: string;
        nome: string;
        descricao: string | null;
        prompt_base: string;
        provider: "gemini" | "openai";
        model: string;
        temperature: number;
        max_history_messages: number;
      }[]
    | null;
};

export type KnowledgeDocument = {
  id: string;
  agent_id: string;
  titulo: string;
  fonte: string | null;
  mime_type: string | null;
  status: "pending" | "processing" | "ready" | "error";
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type KnowledgeChunk = {
  id: string;
  document_id: string;
  agent_id: string;
  chunk_index: number;
  content: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
};