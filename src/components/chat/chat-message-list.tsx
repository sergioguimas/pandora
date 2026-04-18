"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Message } from "@/types/database";
import { cn } from "@/lib/utils";
import { User, Bot } from "lucide-react";

type ChatMessageListProps = {
  messages: Message[];
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
    <div className="flex flex-col gap-6 py-4">
      <AnimatePresence initial={false}>
        {messages.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mx-auto my-8 flex flex-col items-center gap-4 text-center"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20">
              <Bot className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-bold text-foreground">Início da Jornada</p>
              <p className="text-xs text-muted-foreground max-w-[240px]">
                Você está conversando com <span className="font-bold text-primary">{agentName}</span>. Como posso ajudar hoje?
              </p>
            </div>
          </motion.div>
        ) : (
          messages.map((message, index) => {
            const isUser = message.role === "user";
            
            return (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.2, delay: Math.min(index * 0.05, 0.3) }}
                className={cn(
                  "flex w-full items-end gap-3",
                  isUser ? "flex-row-reverse" : "flex-row"
                )}
              >
                {/* Avatar Icon */}
                <div className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-[10px] font-bold shadow-sm",
                  isUser 
                    ? "bg-background border-border text-muted-foreground" 
                    : "bg-primary border-primary/20 text-primary-foreground"
                )}>
                  {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                </div>

                <div className={cn(
                  "flex max-w-[85%] flex-col gap-1 md:max-w-[75%]",
                  isUser ? "items-end" : "items-start"
                )}>
                  {/* Bubble */}
                  <div
                    className={cn(
                      "relative rounded-2xl px-5 py-3 text-sm leading-relaxed shadow-sm transition-all",
                      isUser
                        ? "rounded-br-none bg-primary text-primary-foreground shadow-primary/10"
                        : "rounded-bl-none border border-border/60 bg-card/80 text-card-foreground backdrop-blur-md"
                    )}
                  >
                    <p className="break-words whitespace-pre-wrap font-medium">
                      {message.content}
                    </p>
                  </div>

                  {/* Metadata (Time) */}
                  <span className="px-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50">
                    {format(new Date(message.created_at), "HH:mm", { locale: ptBR })}
                  </span>
                </div>
              </motion.div>
            );
          })
        )}
      </AnimatePresence>

      <div ref={endRef} className="h-4" />
    </div>
  );
}