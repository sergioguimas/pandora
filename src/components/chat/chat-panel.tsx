"use client";

import { useMemo, useState } from "react";
import type { Message } from "@/types/database";
import { ChatInputForm } from "@/components/chat/chat-input-form";
import { ChatMessageList } from "@/components/chat/chat-message-list";
import { ChatTypingIndicator } from "@/components/chat/chat-typing-indicator";

type ChatPanelProps = {
  messages: Message[];
  agentName: string;
  conversationId: string;
  redirectPath: string;
};

type StreamMessage = Message & {
  isStreaming?: boolean;
};

function createTempMessage(
  role: "user" | "assistant",
  content: string,
  conversationId: string
): StreamMessage {
  return {
    id: `temp-${crypto.randomUUID()}`,
    conversation_id: conversationId,
    role,
    content,
    metadata: null,
    created_at: new Date().toISOString(),
    isStreaming: role === "assistant",
  };
}

export function ChatPanel({
  messages,
  agentName,
  conversationId,
  redirectPath,
}: ChatPanelProps) {
  const [localMessages, setLocalMessages] = useState<StreamMessage[]>(
    messages as StreamMessage[]
  );
  const [sending, setSending] = useState(false);

  const renderedMessages = useMemo(() => localMessages, [localMessages]);

  async function handleSendMessage(content: string) {
    const trimmed = content.trim();
    if (!trimmed || sending) return;

    const userMessage = createTempMessage("user", trimmed, conversationId);
    const assistantMessage = createTempMessage("assistant", "", conversationId);

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

      while (!done) {
        const result = await reader.read();
        done = result.done;

        if (result.value) {
          const chunk = decoder.decode(result.value, { stream: true });
          const lines = chunk.split("\n").filter(Boolean);

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;

            const payload = line.slice(6);

            if (payload === "[DONE]") {
              continue;
            }

            const parsed = JSON.parse(payload) as
              | { type: "token"; token: string }
              | { type: "final"; message?: Message }
              | { type: "error"; error: string };

            if (parsed.type === "token") {
              accumulated += parsed.token;

              setLocalMessages((prev) => {
                const next = [...prev];
                const lastIndex = next.length - 1;

                if (lastIndex >= 0 && next[lastIndex]?.role === "assistant") {
                  next[lastIndex] = {
                    ...next[lastIndex],
                    content: accumulated,
                    isStreaming: true,
                  };
                }

                return next;
              });
            }

            if (parsed.type === "final") {
              setLocalMessages((prev) => {
                const next = [...prev];
                const lastIndex = next.length - 1;

                if (lastIndex >= 0 && next[lastIndex]?.role === "assistant") {
                  next[lastIndex] = {
                    ...(parsed.message ??
                      {
                        ...next[lastIndex],
                        content: accumulated,
                      }),
                    content: parsed.message?.content ?? accumulated,
                    isStreaming: false,
                  };
                }

                return next;
              });
            }

            if (parsed.type === "error") {
              throw new Error(parsed.error);
            }
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
          />
          {sending && <ChatTypingIndicator />}
        </div>
      </div>

      <footer className="relative border-t border-border/60 bg-card/40 backdrop-blur-2xl">
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