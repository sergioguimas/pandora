export type Agent = {
  id: string;
  slug: string;
  nome: string;
  descricao: string | null;
  avatar_url: string | null;
  prompt_base: string;
  ativo: boolean;
  created_at: string;
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

export type ConversationWithAgent = {
  id: string;
  user_id: string;
  agent_id: string;
  agents:
    | {
        id: string;
        slug: string;
        nome: string;
      }
    | {
        id: string;
        slug: string;
        nome: string;
      }[]
    | null;
};