"use client";

import { useState } from "react";
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

export function ChatPanel({
  messages,
  agentName,
  conversationId,
  redirectPath,
}: ChatPanelProps) {
  const [sending, setSending] = useState(false);

  return (
    <>
      <div className="relative flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 py-6 md:px-6">
          <ChatMessageList messages={messages} agentName={agentName} />
          {sending && <ChatTypingIndicator />}
        </div>
      </div>

      <footer className="relative border-t border-border/60 bg-card/40 backdrop-blur-2xl">
        <ChatInputForm
          conversationId={conversationId}
          redirectPath={redirectPath}
          agentName={agentName}
          onSendingChange={setSending}
        />
      </footer>
    </>
  );
}