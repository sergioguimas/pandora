"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Message } from "@/types/database";

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
    <>
      {messages.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="self-start rounded-3xl rounded-bl-md border border-border/60 bg-card/80 px-5 py-4 text-sm text-card-foreground shadow-sm backdrop-blur-xl"
        >
          Olá. Esta é o início da sua conversa com {agentName}.
        </motion.div>
      ) : (
        messages.map((message, index) => {
          const isUser = message.role === "user";

          return (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.18, delay: index * 0.01 }}
              className={isUser ? "flex justify-end" : "flex justify-start"}
            >
              <div className="max-w-[88%] md:max-w-[82%]">
                <div
                  className={
                    isUser
                      ? "rounded-3xl rounded-br-md bg-primary px-5 py-3 text-sm leading-6 text-primary-foreground shadow-[0_10px_30px_rgba(16,185,129,0.18)]"
                      : "rounded-3xl rounded-bl-md border border-border/60 bg-card/90 px-5 py-3 text-sm leading-6 text-card-foreground shadow-sm backdrop-blur-xl"
                  }
                >
                  <p className="break-words whitespace-pre-wrap">
                    {message.content}
                  </p>
                </div>

                <p
                  className={`mt-1 px-1 text-xs text-muted-foreground ${
                    isUser ? "text-right" : "text-left"
                  }`}
                >
                  {format(new Date(message.created_at), "HH:mm", {
                    locale: ptBR,
                  })}
                </p>
              </div>
            </motion.div>
          );
        })
      )}

      <div ref={endRef} />
    </>
  );
}