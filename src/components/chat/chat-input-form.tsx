"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { sendMessage } from "@/server/actions/chat-actions";
import { ChatTextarea } from "@/components/chat/chat-textarea";
import { ChatSubmitButton } from "@/components/chat/chat-submit-button";
import { cn } from "@/lib/utils";
import { Sparkles } from "lucide-react";

type ChatInputFormProps = {
  conversationId: string;
  redirectPath: string;
  agentName: string;
  onSendingChange?: (sending: boolean) => void;
};

const initialState = {
  ok: false,
};

export function ChatInputForm({
  conversationId,
  redirectPath,
  agentName,
  onSendingChange,
}: ChatInputFormProps) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const [state, formAction] = useActionState(sendMessage, initialState);
  const [localPending, setLocalPending] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    onSendingChange?.(localPending);
  }, [localPending, onSendingChange]);

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();

      const textarea = formRef.current?.querySelector(
        "textarea"
      ) as HTMLTextAreaElement | null;

      if (textarea) {
        textarea.style.height = "auto";
        textarea.focus();
      }

      setLocalPending(false);
    }
  }, [state]);

  function submitCurrentForm() {
    if (!formRef.current || localPending) return;

    const textarea = formRef.current.querySelector(
      "textarea"
    ) as HTMLTextAreaElement | null;

    if (!textarea) return;

    const content = textarea.value.trim();
    if (!content) return;

    const formData = new FormData(formRef.current);

    setLocalPending(true);
    startTransition(() => formAction(formData));
  }

  return (
    <form
      ref={formRef}
      action={(formData) => {
        setLocalPending(true);
        startTransition(() => formAction(formData));
      }}
      className="mx-auto flex w-full max-w-4xl items-end gap-3 px-4 py-6 md:px-8 md:py-8"
    >
      <input type="hidden" name="conversationId" value={conversationId} />
      <input type="hidden" name="redirectPath" value={redirectPath} />

      {/* Container Principal do Input */}
      <div 
        className={cn(
          "relative flex flex-1 items-end gap-3 rounded-[2rem] border border-border/60 bg-card/60 px-5 py-3 shadow-2xl backdrop-blur-3xl transition-all duration-300",
          "focus-within:border-primary/50 focus-within:bg-card/80 focus-within:shadow-[0_0_25px_rgba(16,185,129,0.12)]",
          localPending && "opacity-80 grayscale-[0.5]"
        )}
      >
        {/* Ícone sutil de indicação */}
        <div className="mb-2 hidden sm:block">
          <Sparkles className={cn(
            "h-5 w-5 transition-colors duration-500",
            localPending ? "text-primary animate-pulse" : "text-muted-foreground/30"
          )} />
        </div>

        <ChatTextarea
          name="content"
          placeholder={`Conversar com ${agentName}...`}
          required
          rows={1}
          className={cn(
            "max-h-40 min-h-[28px] flex-1 resize-none bg-transparent px-1 py-1 text-base leading-relaxed text-foreground outline-none transition-all placeholder:text-muted-foreground/60",
            "scrollbar-none" // Se tiver um helper de utilitário para esconder scroll
          )}
          onEnterSubmit={submitCurrentForm}
        />

        {/* Botão de Enviar (Já deve estar estilizado como discutimos anteriormente) */}
        <div className="mb-0.5">
          <ChatSubmitButton />
        </div>
      </div>
    </form>
  );
}