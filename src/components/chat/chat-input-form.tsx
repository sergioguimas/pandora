"use client";

import { useEffect, useRef, useState } from "react";
import { ChatTextarea } from "@/components/chat/chat-textarea";
import { ChatSubmitButton } from "@/components/chat/chat-submit-button";
import { cn } from "@/lib/utils";
import { Sparkles } from "lucide-react";

type ChatInputFormProps = {
  conversationId: string;
  redirectPath: string;
  agentName: string;
  onSendingChange?: (sending: boolean) => void;
  onSubmitMessage: (content: string) => Promise<void>;
};

export function ChatInputForm({
  conversationId,
  redirectPath,
  agentName,
  onSendingChange,
  onSubmitMessage,
}: ChatInputFormProps) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const [localPending, setLocalPending] = useState(false);

  useEffect(() => {
    onSendingChange?.(localPending);
  }, [localPending, onSendingChange]);

  async function submitCurrentForm() {
    if (!formRef.current || localPending) return;

    const textarea = formRef.current.querySelector(
      "textarea"
    ) as HTMLTextAreaElement | null;

    if (!textarea) return;

    const content = textarea.value.trim();
    if (!content) return;

    try {
      setLocalPending(true);

      // limpa imediatamente
      formRef.current.reset();
      textarea.style.height = "auto";
      textarea.blur();

      await onSubmitMessage(content);
    } finally {
      setLocalPending(false);
      textarea.focus();
    }
  }

  return (
    <form
      ref={formRef}
      onSubmit={(event) => {
        event.preventDefault();
        void submitCurrentForm();
      }}
      className="mx-auto flex w-full max-w-4xl items-end gap-3 px-4 py-5 md:px-8 md:py-6"
    >
      <input type="hidden" name="conversationId" value={conversationId} />
      <input type="hidden" name="redirectPath" value={redirectPath} />

      <div
        className={cn(
          "relative flex flex-1 items-end gap-3 rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3 shadow-2xl backdrop-blur-3xl transition-all duration-300",
          "focus-within:border-emerald-300/40 focus-within:bg-white/[0.06] focus-within:shadow-[0_0_25px_rgba(16,185,129,0.12)]",
          localPending && "opacity-80 grayscale-[0.5]"
        )}
      >
        <div className="mb-2 hidden sm:block">
          <Sparkles
            className={cn(
              "h-5 w-5 transition-colors duration-500",
              localPending
                ? "animate-pulse text-emerald-200"
                : "text-white/30"
            )}
          />
        </div>

        <ChatTextarea
          name="content"
          placeholder={localPending ? "Aguarde a cadeia terminar..." : `Conversar com ${agentName}...`}
          required
          rows={1}
          className={cn(
            "max-h-40 min-h-[28px] flex-1 resize-none bg-transparent px-1 py-1 text-base leading-relaxed text-white outline-none transition-all placeholder:text-white/45",
            "scrollbar-none"
          )}
          onEnterSubmit={() => {
            void submitCurrentForm();
          }}
        />

        <div className="mb-0.5">
          <ChatSubmitButton disabled={localPending} />
        </div>
      </div>
    </form>
  );
}
