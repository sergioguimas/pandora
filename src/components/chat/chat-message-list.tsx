"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bot, User } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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

export function ChatMessageList({
  messages,
  agentName,
  currentUserId,
  userProfiles,
}: ChatMessageListProps) {
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [messages]);

  function getAgentColor(agentId: string | undefined) {
    if (!agentId) return "border-border";

    const colors = [
      "border-blue-500/40 bg-blue-500/10",
      "border-purple-500/40 bg-purple-500/10",
      "border-orange-500/40 bg-orange-500/10",
      "border-pink-500/40 bg-pink-500/10",
      "border-cyan-500/40 bg-cyan-500/10",
    ];

    let hash = 0;

    for (let i = 0; i < agentId.length; i++) {
      hash = agentId.charCodeAt(i) + ((hash << 5) - hash);
    }

    return colors[Math.abs(hash) % colors.length];
  }

  return (
    <div className="flex flex-col gap-4">
      <AnimatePresence initial={false}>
        {messages.map((message, index) => {
          const isUser = message.role === "user";
          const isAssistant = message.role === "assistant";
          const isCurrentUser = isUser && message.user_id === currentUserId;

          const profile = userProfiles.find(
            (item) => item.id === message.user_id
          );

          // 🔥 MULTI-AGENTE
          const metadata = (message.metadata ?? {}) as Record<string, any>;
          const isSynthesis = isAssistant && metadata.agent_id === "pandora-synthesis";

          const agentNameFromMetadata = metadata.agent_name || agentName;

          const senderName = isAssistant
            ? agentNameFromMetadata
            : isCurrentUser
              ? "Você"
              : getDisplayName(profile, message.user_id);

          const avatarLabel = isAssistant
            ? "AI"
            : getInitials(senderName) || "";

          const isEmptyStreamingAssistant =
            isAssistant &&
            message.isStreaming &&
            !(message.content ?? "").trim();

          const previousMessage = messages[index - 1];
          const nextMessage = messages[index + 1];

          const isStartOfAgentBlock =
            isAssistant &&
            (!previousMessage || previousMessage.role === "user");

          const currentStreamingAgentName =
            isAssistant && message.isStreaming ? senderName : null;

          const isEndOfAgentBlock =
            isAssistant &&
            (!nextMessage || nextMessage.role === "user");

          return (
            <div 
              key={message.id}
              className={cn(
                isAssistant && "relative",
                isStartOfAgentBlock && "mt-4",
                isEndOfAgentBlock && "mb-6"
              )}
            >
            {isStartOfAgentBlock && (
              <div className="flex items-center gap-3 my-6">
                <div className="h-px flex-1 bg-border/60" />

                <span className="rounded-full border border-border/60 bg-card px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {currentStreamingAgentName
                    ? `${currentStreamingAgentName} respondendo`
                    : "Rodada de agentes"}
                </span>

                <div className="h-px flex-1 bg-border/60" />
              </div>
            )}
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{
                  duration: 0.2,
                  delay: Math.min(index * 0.05, 0.3),
                }}
                className={cn(
                  "flex w-full items-end gap-3",
                  isCurrentUser ? "flex-row-reverse" : "flex-row",
                  !isUser && "border-l border-border/40 pl-4",
                  isSynthesis && "my-4 border-l-primary/50",
                  message.isStreaming && "opacity-90"
                )}
              >
                {/* Avatar */}
                <div
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-[10px] font-bold shadow-sm",
                    isSynthesis
                      ? "border-primary/40 bg-primary/15 text-primary shadow-primary/20"
                      : isAssistant
                        ? cn("text-foreground shadow-sm", getAgentColor(String(metadata.agent_id ?? "")))
                        : isCurrentUser
                          ? "border-border bg-background text-muted-foreground"
                          : "border-border bg-card text-foreground"
                  )}
                >
                  {isAssistant ? (
                    isSynthesis ? (
                      <Bot className="h-4 w-4" />
                    ) : (
                      getInitials(agentNameFromMetadata) || <Bot className="h-4 w-4" />
                    )
                  ) : avatarLabel ? (
                    avatarLabel
                  ) : (
                    <User className="h-4 w-4" />
                  )}
                </div>

                {/* Conteúdo */}
                <div
                  className={cn(
                    "flex max-w-[85%] flex-col gap-1 md:max-w-[75%]",
                    isCurrentUser ? "items-end" : "items-start"
                  )}
                >
                  {/* Header */}
                  <div
                    className={cn(
                      "flex items-center gap-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60",
                      isCurrentUser && "flex-row-reverse"
                    )}
                  >
                    <span>{senderName}</span>
                    <span>
                      {format(new Date(message.created_at), "HH:mm", {
                        locale: ptBR,
                      })}
                    </span>
                  </div>

                  {/* Bubble */}
                  <div
                    className={cn(
                      "relative rounded-2xl px-5 py-3 text-sm leading-relaxed shadow-sm transition-all",
                      isSynthesis
                        ? "rounded-bl-none border border-primary/30 bg-primary/10 text-foreground shadow-[0_0_30px_rgba(16,185,129,0.08)]"
                        : isCurrentUser
                          ? "rounded-br-none bg-primary text-primary-foreground shadow-primary/10"
                          : isAssistant
                            ? cn(
                                "rounded-bl-none border text-card-foreground backdrop-blur-md",
                                getAgentColor(String(metadata.agent_id ?? ""))
                              )
                            : "rounded-bl-none border border-border/60 bg-muted/50 text-foreground"
                    )}
                  >
                    {isSynthesis ? (
                      <div className="mb-3 flex items-center gap-2 border-b border-primary/20 pb-3">
                        <span className="rounded-full border border-primary/30 bg-primary/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-primary">
                          Síntese final
                        </span>
                        <span className="text-xs font-medium text-muted-foreground">
                          Consolidação das respostas dos agentes
                        </span>
                      </div>
                    ) : null}

                    {isEmptyStreamingAssistant ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span className="font-medium">
                          {agentNameFromMetadata} está digitando
                        </span>

                        <div className="flex items-center gap-1.5">
                          {[0, 1, 2].map((dot) => (
                            <motion.span
                              key={dot}
                              initial={{ y: 0, opacity: 0.4 }}
                              animate={{
                                y: [0, -5, 0],
                                opacity: [0.4, 1, 0.4],
                              }}
                              transition={{
                                duration: 0.8,
                                repeat: Infinity,
                                ease: "easeInOut",
                                delay: dot * 0.12,
                              }}
                              className="h-2 w-2 rounded-full bg-current"
                            />
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="break-words whitespace-pre-wrap font-medium">
                        {message.content}
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>
            </div>
          );
        })}
      </AnimatePresence>

      <div ref={endRef} className="h-4" />
    </div>
  );
}