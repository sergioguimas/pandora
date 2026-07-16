import { createClient } from "@/lib/supabase/server";

// Runtime de IA compartilhado pelos route handlers de chat (stream e retry).
// Centraliza classificação de erro, retry/timeout, streaming SSE e persistência
// de mensagens para que os dois caminhos não divirjam. Ver docs/FLUXO-DE-CHAT.md.

// --- Constantes de geração -------------------------------------------------

export const MODEL_TIMEOUT_MS = 75000;
export const RETRY_DELAYS_MS = [800, 2000] as const;
export const MODEL_MAX_RETRIES = 2;

// Modo de resposta: definido em `@/lib/response-mode` (módulo puro, também
// consumido pelo editor de agentes no cliente). Reexportado aqui por
// conveniência dos consumidores de servidor.
export {
  DEFAULT_RESPONSE_MODE,
  isResponseMode,
  maxOutputTokensFor,
  RESPONSE_MODE_LABELS,
  RESPONSE_MODE_MAX_TOKENS,
  RESPONSE_MODES,
  type ResponseMode,
} from "@/lib/response-mode";

// --- Tipos -----------------------------------------------------------------

export type Message = {
  id: string;
  conversation_id: string;
  user_id: string | null;
  role: "user" | "assistant" | "system";
  content: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type ModelErrorCode =
  | "MODEL_TEMPORARILY_UNAVAILABLE"
  | "MODEL_TIMEOUT"
  | "MODEL_RATE_LIMITED"
  | "MODEL_STREAM_INTERRUPTED"
  | "MODEL_UNKNOWN_ERROR";

export type ModelErrorInfo = {
  code: ModelErrorCode;
  status?: number;
  message: string;
  retryable: boolean;
};

export class ModelGenerationError extends Error {
  code: ModelErrorCode;
  status?: number;
  partialContent?: string;
  /**
   * Se vale a pena reenviar. Carregado explicitamente porque o veredito do
   * `classifyModelError` era perdido no wrap: tudo virava retryable, e o
   * usuário via "tentar novamente" até para erro que nunca funcionaria
   * (prompt bloqueado por safety, provider não implementado).
   */
  retryable: boolean;

  constructor(params: {
    message: string;
    code: ModelErrorCode;
    status?: number;
    partialContent?: string;
    retryable?: boolean;
  }) {
    super(params.message);
    this.name = "ModelGenerationError";
    this.code = params.code;
    this.status = params.status;
    this.partialContent = params.partialContent;
    this.retryable = params.retryable ?? true;
  }
}

// --- Serialização / SSE ----------------------------------------------------

export function sse(data: unknown) {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export function sanitizeJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

// --- Timing ----------------------------------------------------------------

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message = "Tempo limite excedido."
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(message)), timeoutMs);
    }),
  ]);
}

// --- Texto -----------------------------------------------------------------

export function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function removeActionJson(text: string) {
  return text
    .replace(/\{[\s\S]*?"action"\s*:\s*"call_agent"[\s\S]*?\}/g, "")
    .trim();
}

// Respostas abaixo disto só são suspeitas se não terminarem de forma conclusiva.
const SHORT_ANSWER_LENGTH = 40;

// Pontuação/fechamento que indica frase terminada.
const ENDS_CONCLUSIVELY = /[.!?…)\]}"'`]\s*$/;

// Terminações que denunciam corte no meio (linha de tabela, rótulo sem valor…).
const DANGLING_PATTERNS = [
  /\|\s*$/,
  /-\s*$/,
  /:\s*$/,
  /\bR\$\s*$/,
  /\bOpção\s*$/i,
  /\*\*Opção\s*$/i,
  /\bPlano\s*$/i,
  /\bCusto\s*$/i,
  /\bQuantidade\s*$/i,
  /\bSugestão de Venda\s*$/i,
  /\bModelo\s*$/i,
  /\bEquipamento\s*$/i,
];

/**
 * Heurística de resposta truncada.
 *
 * PD-19: antes, QUALQUER resposta com menos de 40 caracteres era acusada de
 * truncada — "Sim, o plano custa R$ 100." virava `partial`, disparava aviso e
 * mostrava "tentar novamente", como se o agente tivesse falhado. O piso agora
 * só vale quando a resposta também não termina de forma conclusiva, o que
 * preserva a detecção real ("O plano Essencial" — cortado, sem pontuação).
 */
export function isProbablyIncompleteAnswer(text: string) {
  const trimmed = text.trim();

  if (!trimmed) return true;

  if (DANGLING_PATTERNS.some((pattern) => pattern.test(trimmed))) {
    return true;
  }

  const boldMarkerCount = (trimmed.match(/\*\*/g) ?? []).length;
  if (boldMarkerCount % 2 !== 0) return true;

  const codeFenceCount = (trimmed.match(/```/g) ?? []).length;
  if (codeFenceCount % 2 !== 0) return true;

  if (trimmed.length < SHORT_ANSWER_LENGTH && !ENDS_CONCLUSIVELY.test(trimmed)) {
    return true;
  }

  return false;
}

// --- Classificação de erro do provedor -------------------------------------

export function getErrorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;

  const maybeError = error as {
    status?: unknown;
    code?: unknown;
    response?: { status?: unknown };
    cause?: { status?: unknown };
  };

  const status =
    maybeError.status ??
    maybeError.response?.status ??
    maybeError.cause?.status ??
    maybeError.code;

  if (typeof status === "number") return status;

  if (typeof status === "string") {
    const parsed = Number(status);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

export function classifyModelError(error: unknown): ModelErrorInfo {
  const status = getErrorStatus(error);
  const rawMessage =
    error instanceof Error ? error.message : "Erro ao gerar resposta.";

  const lowerMessage = rawMessage.toLowerCase();

  if (
    status === 503 ||
    lowerMessage.includes("503") ||
    lowerMessage.includes("unavailable") ||
    lowerMessage.includes("overloaded")
  ) {
    return {
      code: "MODEL_TEMPORARILY_UNAVAILABLE",
      status: 503,
      retryable: true,
      message:
        "O provedor de IA está temporariamente indisponível. Tente novamente em instantes.",
    };
  }

  if (
    status === 429 ||
    lowerMessage.includes("429") ||
    lowerMessage.includes("rate limit")
  ) {
    return {
      code: "MODEL_RATE_LIMITED",
      status: 429,
      retryable: true,
      message:
        "O provedor de IA limitou temporariamente as requisições. Tente novamente em instantes.",
    };
  }

  if (status === 500 || status === 502 || status === 504) {
    return {
      code: "MODEL_TEMPORARILY_UNAVAILABLE",
      status,
      retryable: true,
      message:
        "O provedor de IA falhou temporariamente. Tente novamente em instantes.",
    };
  }

  if (
    lowerMessage.includes("tempo limite") ||
    lowerMessage.includes("timeout") ||
    (error instanceof Error && error.name === "AbortError")
  ) {
    return {
      code: "MODEL_TIMEOUT",
      status,
      retryable: true,
      message: "A resposta demorou mais que o esperado e foi interrompida.",
    };
  }

  return {
    code: "MODEL_UNKNOWN_ERROR",
    status,
    retryable: false,
    message: rawMessage || "Erro ao gerar resposta.",
  };
}

export async function withRetryBeforeStreaming<T>(
  fn: () => Promise<T>,
  options?: {
    retries?: number;
    delaysMs?: readonly number[];
  }
): Promise<T> {
  const retries = options?.retries ?? MODEL_MAX_RETRIES;
  const delaysMs = options?.delaysMs ?? RETRY_DELAYS_MS;

  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      const classified = classifyModelError(error);

      if (!classified.retryable || attempt >= retries) {
        throw error;
      }

      await sleep(delaysMs[attempt] ?? 2000);
    }
  }

  throw lastError;
}

// --- Persistência ----------------------------------------------------------

export async function saveMessage(params: {
  conversationId: string;
  userId?: string | null;
  role: "user" | "assistant" | "system";
  content: string;
  metadata?: Record<string, unknown> | null;
}): Promise<Message> {
  const supabase = await createClient();

  const payload = sanitizeJson({
    conversation_id: params.conversationId,
    user_id: params.userId ?? null,
    role: params.role,
    content: params.content,
    metadata: params.metadata ?? null,
  });

  const { data, error } = await supabase
    .from("messages")
    .insert(payload)
    .select("id, conversation_id, user_id, role, content, metadata, created_at")
    .single();

  if (error || !data) {
    console.error("Erro ao salvar mensagem no Supabase:", {
      error,
      payload: {
        ...payload,
        content:
          payload.content.length > 500
            ? `${payload.content.slice(0, 500)}...`
            : payload.content,
      },
    });

    throw new Error(
      error?.message
        ? `Erro ao salvar mensagem: ${error.message}`
        : "Erro ao salvar mensagem."
    );
  }

  return data as Message;
}
