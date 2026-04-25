"use client";

import { useEffect, useMemo, useState } from "react";
import type { Message } from "@/types/database";
import { createClient } from "@/lib/supabase/client";
import { ChatInputForm } from "@/components/chat/chat-input-form";
import { ChatMessageList } from "@/components/chat/chat-message-list";
import { ChatTypingIndicator } from "@/components/chat/chat-typing-indicator";

type UserProfile = {
  id: string;
  nome: string | null;
  email: string | null;
  avatar_url: string | null;
};

type ChatPanelProps = {
  messages: Message[];
  agentName: string;
  conversationId: string;
  redirectPath: string;
  currentUserId: string;
  userProfiles: UserProfile[];
  activeAgentsCount?: number;
  orchestrationMode?: "single" | "chain";
};

type StreamMessage = Message & {
  isStreaming?: boolean;
};

function createTempMessage(
  role: "user" | "assistant",
  content: string,
  conversationId: string,
  userId: string | null
): StreamMessage {
  return {
    id: `temp-${crypto.randomUUID()}`,
    conversation_id: conversationId,
    user_id: userId,
    role,
    content,
    metadata: null,
    created_at: new Date().toISOString(),
    isStreaming: role === "assistant",
  };
}

function mergeRealtimeMessage(
  prev: StreamMessage[],
  newMessage: Message
): StreamMessage[] {
  const alreadyExists = prev.some((message) => message.id === newMessage.id);

  if (alreadyExists) {
    return prev;
  }

  const equivalentTempIndex = prev.findIndex(
    (message) =>
      message.id.startsWith("temp-") &&
      message.role === newMessage.role &&
      message.content === newMessage.content &&
      message.conversation_id === newMessage.conversation_id &&
      message.user_id === newMessage.user_id
  );

  if (equivalentTempIndex >= 0) {
    const next = [...prev];

    next[equivalentTempIndex] = {
      ...newMessage,
      isStreaming: next[equivalentTempIndex].isStreaming,
    };

    return next;
  }

  return [...prev, newMessage];
}

export function ChatPanel({
  messages,
  agentName,
  conversationId,
  redirectPath,
  currentUserId,
  userProfiles,
  activeAgentsCount = 1,
  orchestrationMode = "single",
}: ChatPanelProps) {
  const [localMessages, setLocalMessages] = useState<StreamMessage[]>(
    messages as StreamMessage[]
  );

  const [sending, setSending] = useState(false);

  const renderedMessages = useMemo(() => localMessages, [localMessages]);

  const hasStreamingMessage = renderedMessages.some(
    (message) => message.role === "assistant" && message.isStreaming
  );

  const isMultiAgent = activeAgentsCount > 1;

  const statusText = sending
    ? isMultiAgent
      ? `Executando cadeia de ${activeAgentsCount} agentes...`
      : `${agentName} está respondendo...`
    : isMultiAgent
      ? `Modo encadeado • ${activeAgentsCount} agentes ativos`
      : `Modo individual • ${agentName}`;

  useEffect(() => {
    setLocalMessages(messages as StreamMessage[]);
  }, [conversationId, messages]);

  useEffect(() => {
    let active = true;

    async function subscribeToMessages() {
      console.log("🔌 Realtime effect mounted:", conversationId);

      const supabase = createClient();

      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error) {
        console.error("Erro ao buscar sessão do Realtime:", error);
        return;
      }

      if (!session?.access_token) {
        console.warn("Realtime sem sessão autenticada.");
        return;
      }

      supabase.realtime.setAuth(session.access_token);

      if (!active) return;

      const channel = supabase
        .channel(`messages:${conversationId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: `conversation_id=eq.${conversationId}`,
          },
          (payload) => {
            console.log("🔥 REALTIME RECEIVED:", payload);

            const newMessage = payload.new as Message;

            setLocalMessages((prev) => mergeRealtimeMessage(prev, newMessage));
          }
        )
        .subscribe((status) => {
          console.log("📡 Realtime status:", status);
        });

      return () => {
        console.log("❌ Realtime cleanup:", conversationId);
        supabase.removeChannel(channel);
      };
    }

    let cleanup: void | (() => void);

    subscribeToMessages().then((fn) => {
      cleanup = fn;
    });

    return () => {
      active = false;

      if (typeof cleanup === "function") {
        cleanup();
      }
    };
  }, [conversationId]);

  async function handleSendMessage(content: string) {
    const trimmed = content.trim();

    if (!trimmed || sending) return;

    const userMessage = createTempMessage(
      "user",
      trimmed,
      conversationId,
      currentUserId
    );

    const assistantMessage = createTempMessage(
      "assistant",
      "",
      conversationId,
      null
    );

    setSending(true);
    setLocalMessages((prev) => [...prev, userMessage, assistantMessage]);

    try {
      const response = await fetch("/api/chat/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          conversationId,
          content: trimmed,
          redirectPath,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error("Falha ao iniciar stream da resposta.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let done = false;
      let accumulated = "";
      let buffer = "";

      while (!done) {
        const result = await reader.read();
        done = result.done;

        if (!result.value) continue;

        buffer += decoder.decode(result.value, { stream: true });

        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";

        for (const event of events) {
          const lines = event.split("\n");
          const dataLines = lines
            .filter((line) => line.startsWith("data: "))
            .map((line) => line.slice(6));

          if (dataLines.length === 0) continue;

          const payload = dataLines.join("\n");

          if (payload === "[DONE]") {
            continue;
          }

          const parsed = JSON.parse(payload) as
            | {
                type: "token";
                token: string;
                agentId?: string;
                agentName?: string; }
            | {
                type: "agent_call";
                fromAgentId: string;
                fromAgentName: string;
                toAgentId: string;
                toAgentName: string;
                reason: string | null; }
            | {
                type: "orchestration_plan";
                agents: Array<{ id: string; name: string }>; }
            | { type: "saved_user"; message: Message }
            | { type: "final"; message?: Message }
            | { type: "error"; error: string };

          if (parsed.type === "saved_user") {
            setLocalMessages((prev) =>
              mergeRealtimeMessage(prev, parsed.message)
            );

            continue;
          }

          if (parsed.type === "token") {
            const streamAgentId = parsed.agentId ?? "default-agent";
            const streamAgentName = parsed.agentName ?? agentName;
            const tempId = `temp-assistant-${streamAgentId}`;

            setLocalMessages((prev) => {
              const existingIndex = prev.findIndex(
                (message) => message.id === tempId
              );

              if (existingIndex >= 0) {
                const next = [...prev];
                const current = next[existingIndex];

                next[existingIndex] = {
                  ...current,
                  content: `${current.content ?? ""}${parsed.token}`,
                  isStreaming: true,
                };

                return next;
              }

              return [
                ...prev,
                {
                  id: tempId,
                  conversation_id: conversationId,
                  user_id: null,
                  role: "assistant",
                  content: parsed.token,
                  metadata: {
                    agent_id: streamAgentId,
                    agent_name: streamAgentName,
                  },
                  created_at: new Date().toISOString(),
                  isStreaming: true,
                },
              ];
            });

            continue;
          }

          if (parsed.type === "agent_call") {
            setLocalMessages((prev) => [
              ...prev,
              {
                id: `temp-agent-call-${crypto.randomUUID()}`,
                conversation_id: conversationId,
                user_id: null,
                role: "system",
                content: `${parsed.fromAgentName} chamou ${parsed.toAgentName}${
                  parsed.reason ? `: ${parsed.reason}` : "."
                }`,
                metadata: {
                  type: "agent_call",
                  from_agent_id: parsed.fromAgentId,
                  from_agent_name: parsed.fromAgentName,
                  to_agent_id: parsed.toAgentId,
                  to_agent_name: parsed.toAgentName,
                  reason: parsed.reason,
                },
                created_at: new Date().toISOString(),
              },
            ]);

            continue;
          }

          if (parsed.type === "orchestration_plan") {
            setLocalMessages((prev) => [
              ...prev,
              {
                id: `temp-orchestration-plan-${crypto.randomUUID()}`,
                conversation_id: conversationId,
                user_id: null,
                role: "system",
                content: `Orquestrador definiu a ordem: ${parsed.agents
                  .map((agent, index) => `#${index + 1} ${agent.name}`)
                  .join(" → ")}`,
                metadata: {
                  type: "orchestration_plan",
                  agents: parsed.agents,
                },
                created_at: new Date().toISOString(),
              },
            ]);

            continue;
          }

          if (parsed.type === "final") {
            const finalMessage = parsed.message;

            if (!finalMessage) {
              continue;
            }

            setLocalMessages((prev) => {
              const metadata =
                finalMessage.metadata && typeof finalMessage.metadata === "object"
                  ? finalMessage.metadata
                  : {};

              const agentId = (metadata as Record<string, unknown>).agent_id;

              const tempId =
                typeof agentId === "string" ? `temp-assistant-${agentId}` : null;

              if (!tempId) {
                return mergeRealtimeMessage(prev, finalMessage);
              }

              const existingIndex = prev.findIndex(
                (message) => message.id === tempId
              );

              if (existingIndex >= 0) {
                const next = [...prev];

                next[existingIndex] = {
                  ...finalMessage,
                  isStreaming: false,
                };

                return next;
              }

              return mergeRealtimeMessage(prev, finalMessage);
            });

            continue;
          }

          if (parsed.type === "error") {
            throw new Error(parsed.error);
          }
        }
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erro ao enviar mensagem.";

      setLocalMessages((prev) => {
        const next = [...prev];
        const lastIndex = next.length - 1;

        if (lastIndex >= 0 && next[lastIndex]?.role === "assistant") {
          next[lastIndex] = {
            ...next[lastIndex],
            content: `Erro: ${message}`,
            isStreaming: false,
          };
        }

        return next;
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <div className="relative flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 py-6 md:px-6">
          <ChatMessageList
            messages={renderedMessages}
            agentName={agentName}
            currentUserId={currentUserId}
            userProfiles={userProfiles}
          />

          {sending && !hasStreamingMessage ? <ChatTypingIndicator /> : null}
        </div>
      </div>

      <footer className="relative border-t border-border/60 bg-card/40 backdrop-blur-2xl">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-3 px-4 pt-4 text-xs text-muted-foreground md:px-8">
          <div className="flex min-w-0 items-center gap-2">
            <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
            <span className="truncate font-medium">{statusText}</span>
          </div>

          {isMultiAgent ? (
            <span className="hidden shrink-0 rounded-full border border-border/60 bg-background/60 px-2.5 py-1 font-semibold md:inline-flex">
              Encadeado
            </span>
          ) : null}
        </div>

        <ChatInputForm
          conversationId={conversationId}
          redirectPath={redirectPath}
          agentName={agentName}
          onSendingChange={setSending}
          onSubmitMessage={handleSendMessage}
        />
      </footer>
    </>
  );
}