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

type ChatMessageListProps = {
  messages: StreamMessage[];
  agentName: string;
};

export function ChatMessageList({
  messages,
  agentName,
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
          const isEmptyStreamingAssistant =
            message.role === "assistant" &&
            message.isStreaming &&
            !(message.content ?? "").trim();

          return (
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
                isUser ? "flex-row-reverse" : "flex-row"
              )}
            >
              <div
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-[10px] font-bold shadow-sm",
                  isUser
                    ? "border-border bg-background text-muted-foreground"
                    : "border-primary/20 bg-primary text-primary-foreground"
                )}
              >
                {isUser ? (
                  <User className="h-4 w-4" />
                ) : (
                  <Bot className="h-4 w-4" />
                )}
              </div>

              <div
                className={cn(
                  "flex max-w-[85%] flex-col gap-1 md:max-w-[75%]",
                  isUser ? "items-end" : "items-start"
                )}
              >
                <div
                  className={cn(
                    "relative rounded-2xl px-5 py-3 text-sm leading-relaxed shadow-sm transition-all",
                    isUser
                      ? "rounded-br-none bg-primary text-primary-foreground shadow-primary/10"
                      : "rounded-bl-none border border-border/60 bg-card/80 text-card-foreground backdrop-blur-md"
                  )}
                >
                  {isEmptyStreamingAssistant ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="font-medium">Digitando</span>

                      <div className="flex items-center gap-1.5">
                        {[0, 1, 2].map((dot) => (
                          <motion.span
                            key={dot}
                            initial={{ y: 0, opacity: 0.4 }}
                            animate={{ y: [0, -5, 0], opacity: [0.4, 1, 0.4] }}
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

                <span className="px-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50">
                  {format(new Date(message.created_at), "HH:mm", {
                    locale: ptBR,
                  })}
                </span>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>

      <div ref={endRef} className="h-4" />
    </div>
  );
}