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

function getAgentColor(agentId: string | undefined) {
  if (!agentId) return "border-white/10 bg-white/[0.04]";

  const colors = [
    "border-blue-300/25 bg-blue-300/10",
    "border-emerald-300/25 bg-emerald-300/10",
    "border-cyan-300/25 bg-cyan-300/10",
    "border-amber-300/25 bg-amber-300/10",
    "border-rose-300/25 bg-rose-300/10",
  ];

  let hash = 0;

  for (let i = 0; i < agentId.length; i++) {
    hash = agentId.charCodeAt(i) + ((hash << 5) - hash);
  }

  return colors[Math.abs(hash) % colors.length];
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
          const metadata = (message.metadata ?? {}) as Record<string, unknown>;
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
          const previousMessage = messages[index - 1];
          const nextMessage = messages[index + 1];
          const isStartOfAgentBlock =
            isAssistant &&
            (!previousMessage || previousMessage.role === "user");
          const isEndOfAgentBlock =
            isAssistant && (!nextMessage || nextMessage.role === "user");
          const systemType =
            typeof metadata.type === "string" ? metadata.type : null;

          if (message.role === "system") {
            const isAgentCall = systemType === "agent_call";

            return (
              <div key={message.id} className="my-3 flex justify-center">
                <div
                  className={cn(
                    "rounded-md border px-4 py-2 text-xs font-semibold",
                    isAgentCall
                      ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100"
                      : "border-white/10 bg-white/[0.04] text-white/55"
                  )}
                >
                  {message.content}
                </div>
              </div>
            );
          }

          return (
            <div
              key={message.id}
              className={cn(
                isAssistant && "relative",
                isStartOfAgentBlock && "mt-4",
                isEndOfAgentBlock && "mb-6"
              )}
            >
              {isStartOfAgentBlock ? (
                <div className="my-6 flex items-center gap-3">
                  <div className="h-px flex-1 bg-white/10" />

                  <span className="rounded-md border border-white/10 bg-[#020817] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white/45">
                    {message.isStreaming
                      ? `${senderName} respondendo`
                      : "Rodada de agentes"}
                  </span>

                  <div className="h-px flex-1 bg-white/10" />
                </div>
              ) : null}

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
                  !isUser && "border-l border-white/10 pl-4",
                  isSynthesis && "my-4 border-l-emerald-300/50",
                  message.isStreaming && "opacity-90"
                )}
              >
                <div
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-[10px] font-bold shadow-sm",
                    isSynthesis
                      ? "border-emerald-300/35 bg-emerald-300/12 text-emerald-100"
                      : isAssistant
                        ? cn("text-white", getAgentColor(agentId))
                        : isCurrentUser
                          ? "border-white bg-white text-[#020817]"
                          : "border-white/10 bg-white/[0.04] text-white"
                  )}
                >
                  {isAssistant ? (
                    isSynthesis ? (
                      <Bot className="h-4 w-4" />
                    ) : (
                      getInitials(agentNameFromMetadata) || (
                        <Bot className="h-4 w-4" />
                      )
                    )
                  ) : avatarLabel ? (
                    avatarLabel
                  ) : (
                    <User className="h-4 w-4" />
                  )}
                </div>

                <div
                  className={cn(
                    "flex max-w-[85%] flex-col gap-1 md:max-w-[75%]",
                    isCurrentUser ? "items-end" : "items-start"
                  )}
                >
                  <div
                    className={cn(
                      "flex items-center gap-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-white/45",
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

                  <div
                    className={cn(
                      "relative rounded-lg px-4 py-3 text-sm leading-relaxed shadow-sm transition-all",
                      isSynthesis
                        ? "border border-emerald-300/25 bg-emerald-300/10 text-white"
                        : isCurrentUser
                          ? "bg-white text-[#020817]"
                          : isAssistant
                            ? cn(
                                "border text-white backdrop-blur-md",
                                getAgentColor(agentId)
                              )
                            : "border border-white/10 bg-white/[0.04] text-white"
                    )}
                  >
                    {isSynthesis ? (
                      <div className="mb-3 flex items-center gap-2 border-b border-emerald-300/20 pb-3">
                        <span className="rounded-md border border-emerald-300/25 bg-emerald-300/10 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-100">
                          Síntese final
                        </span>
                        <span className="text-xs font-medium text-white/50">
                          Consolidação dos agentes
                        </span>
                      </div>
                    ) : null}

                    {isEmptyStreamingAssistant ? (
                      <div className="flex items-center gap-2 text-sm text-white/55">
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
                      <p className="whitespace-pre-wrap break-words font-medium">
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
