"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bot, Sparkles, User } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { RetryMessageButton } from "./retry-message-button";
import { cn } from "@/lib/utils";
import type { Message } from "@/types/database";

type StreamMessage = Message & {
  isStreaming?: boolean;
};

type UserProfile = {
  id: string;
  nome: string | null;
  email: string | null;
  avatar_url: string | null;
};

type ChatMessageListProps = {
  messages: StreamMessage[];
  agentName: string;
  currentUserId: string;
  userProfiles: UserProfile[];
  onRetryMessage?: (assistantMessageId: string) => void;
};

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function getDisplayName(
  profile: UserProfile | undefined,
  fallbackId: string | null
) {
  if (!fallbackId) return "Usuário";
  return profile?.nome || profile?.email || "Usuário";
}

function formatTime(value: string) {
  return format(new Date(value), "HH:mm", { locale: ptBR });
}

export function ChatMessageList({
  messages,
  agentName,
  currentUserId,
  userProfiles,
  onRetryMessage,
}: ChatMessageListProps) {
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [messages]);

  return (
    <div className="flex flex-col gap-2">
      <AnimatePresence initial={false}>
        {messages.map((message, index) => {
          const isUser = message.role === "user";
          const isAssistant = message.role === "assistant";
          const isCurrentUser = isUser && message.user_id === currentUserId;
          const profile = userProfiles.find(
            (item) => item.id === message.user_id
          );
          const metadata = (message.metadata ?? {}) as Record<string, unknown>;
          const metadataStatus =
            typeof metadata.status === "string" ? metadata.status : null;

          const canRetry =
            isAssistant &&
            metadata.retryable === true &&
            metadata.retrying !== true &&
            metadataStatus !== "completed" &&
            metadataStatus !== "superseded" &&
            !message.isStreaming;

          const isSuperseded = metadataStatus === "superseded";
          const agentId =
            typeof metadata.agent_id === "string" ? metadata.agent_id : "";
          const metadataAgentName =
            typeof metadata.agent_name === "string"
              ? metadata.agent_name
              : null;
          const isSynthesis = isAssistant && agentId === "pandora-synthesis";
          const agentNameFromMetadata = metadataAgentName || agentName;
          const senderName = isAssistant
            ? agentNameFromMetadata
            : isCurrentUser
              ? "Você"
              : getDisplayName(profile, message.user_id);
          const avatarLabel = isAssistant ? "AI" : getInitials(senderName) || "";
          const isEmptyStreamingAssistant =
            isAssistant &&
            message.isStreaming &&
            !(message.content ?? "").trim();

          const orchestration = (metadata.orchestration ?? {}) as {
            mode?: string;
            order?: number;
          };
          const isChainContribution =
            isAssistant && !isSynthesis && orchestration.mode === "chain";
          const chainOrder =
            isChainContribution && typeof orchestration.order === "number"
              ? orchestration.order
              : null;

          const previousMessage = messages[index - 1];
          const isStartOfAgentBlock =
            isAssistant &&
            !isSynthesis &&
            (!previousMessage || previousMessage.role === "user");
          const systemType =
            typeof metadata.type === "string" ? metadata.type : null;

          if (message.role === "system") {
            const isAgentCall = systemType === "agent_call";

            return (
              <div key={message.id} className="my-2 flex justify-center">
                <div
                  className={cn(
                    "rounded-md px-3 py-1.5 font-mono text-xs",
                    isAgentCall
                      ? "bg-primary-soft text-primary"
                      : "bg-surface-2 text-muted-foreground"
                  )}
                >
                  {message.content}
                </div>
              </div>
            );
          }

          // Resposta final consolidada — tratada como um resultado, não como um balão.
          if (isSynthesis) {
            return (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className={cn("my-2", isSuperseded && "opacity-45")}
              >
                <div className="mb-2.5 flex items-center gap-3">
                  <div className="h-px flex-1 bg-primary/30" />
                  <span className="font-mono text-[11px] uppercase tracking-wider text-primary">
                    resposta final
                  </span>
                  <div className="h-px flex-1 bg-primary/30" />
                </div>

                <div className="overflow-hidden rounded-lg border border-primary/35 bg-primary-soft">
                  <div className="flex items-center gap-2 border-b border-primary/20 px-4 py-2.5">
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/20 text-primary">
                      <Sparkles className="h-3.5 w-3.5" />
                    </span>
                    <span className="text-sm font-semibold text-foreground">
                      Síntese Pandora
                    </span>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      consolidação dos agentes
                    </span>
                    <span className="ml-auto font-mono text-[11px] text-subtle-foreground">
                      {formatTime(message.created_at)}
                    </span>
                  </div>

                  <div className="px-4 py-3 text-sm leading-relaxed text-foreground">
                    <p className="whitespace-pre-wrap break-words">
                      {message.content}
                    </p>

                    {isSuperseded ? (
                      <p className="mt-2.5 border-t border-primary/20 pt-2.5 font-mono text-xs text-subtle-foreground">
                        Substituída por uma nova tentativa.
                      </p>
                    ) : null}

                    {canRetry ? (
                      <RetryMessageButton
                        assistantMessageId={message.id}
                        onRetryMessage={onRetryMessage}
                      />
                    ) : null}
                  </div>
                </div>
              </motion.div>
            );
          }

          return (
            <div key={message.id}>
              {isStartOfAgentBlock && previousMessage ? (
                <div className="my-4 flex items-center gap-3">
                  <div className="h-px flex-1 bg-border" />
                  <span className="font-mono text-[11px] uppercase tracking-wider text-subtle-foreground">
                    {message.isStreaming
                      ? `${senderName} respondendo`
                      : "rodada de agentes"}
                  </span>
                  <div className="h-px flex-1 bg-border" />
                </div>
              ) : null}

              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className={cn(
                  "flex w-full items-start gap-2.5",
                  isCurrentUser ? "flex-row-reverse" : "flex-row",
                  isSuperseded && "opacity-45"
                )}
              >
                <div
                  className={cn(
                    "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md font-mono text-[11px] font-semibold",
                    isCurrentUser
                      ? "bg-primary/15 text-primary"
                      : "border border-border bg-surface-2 text-muted-foreground"
                  )}
                >
                  {isAssistant ? (
                    getInitials(agentNameFromMetadata) || (
                      <Bot className="h-4 w-4" />
                    )
                  ) : avatarLabel ? (
                    avatarLabel
                  ) : (
                    <User className="h-4 w-4" />
                  )}
                </div>

                <div
                  className={cn(
                    "flex max-w-[82%] flex-col gap-1 md:max-w-[70%]",
                    isCurrentUser ? "items-end" : "items-start"
                  )}
                >
                  <div
                    className={cn(
                      "flex items-center gap-2 px-0.5 font-mono text-[11px] text-subtle-foreground",
                      isCurrentUser && "flex-row-reverse"
                    )}
                  >
                    {chainOrder ? (
                      <span className="rounded bg-surface-2 px-1.5 py-0.5 font-semibold text-muted-foreground">
                        #{chainOrder}
                      </span>
                    ) : null}
                    <span className="font-medium text-muted-foreground">
                      {senderName}
                    </span>
                    <span>{formatTime(message.created_at)}</span>
                  </div>

                  <div
                    className={cn(
                      "relative rounded-lg px-3.5 py-2.5 text-sm leading-relaxed",
                      isCurrentUser
                        ? "rounded-tr-sm bg-bubble-user text-bubble-user-foreground"
                        : cn(
                            "rounded-tl-sm border bg-bubble-agent text-bubble-agent-foreground",
                            isChainContribution
                              ? "border-border border-l-2 border-l-border-strong"
                              : "border-border"
                          )
                    )}
                  >
                    {isEmptyStreamingAssistant ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>{agentNameFromMetadata} está digitando</span>
                        <div className="flex items-center gap-1">
                          {[0, 1, 2].map((dot) => (
                            <motion.span
                              key={dot}
                              initial={{ opacity: 0.3 }}
                              animate={{ opacity: [0.3, 1, 0.3] }}
                              transition={{
                                duration: 0.9,
                                repeat: Infinity,
                                ease: "easeInOut",
                                delay: dot * 0.15,
                              }}
                              className="h-1.5 w-1.5 rounded-full bg-current"
                            />
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap break-words">
                        {message.content}
                      </p>
                    )}

                    {metadata.retrying === true ? (
                      <p className="mt-2.5 border-t border-border/60 pt-2.5 font-mono text-xs text-muted-foreground">
                        Gerando nova resposta…
                      </p>
                    ) : null}

                    {isSuperseded ? (
                      <p className="mt-2.5 border-t border-border/60 pt-2.5 font-mono text-xs text-subtle-foreground">
                        Substituída por uma nova tentativa.
                      </p>
                    ) : null}

                    {canRetry ? (
                      <RetryMessageButton
                        assistantMessageId={message.id}
                        onRetryMessage={onRetryMessage}
                      />
                    ) : null}
                  </div>
                </div>
              </motion.div>
            </div>
          );
        })}
      </AnimatePresence>

      <div ref={endRef} className="h-2" />
    </div>
  );
}
