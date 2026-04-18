"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { sendMessage } from "@/server/actions/chat-actions";
import { ChatTextarea } from "@/components/chat/chat-textarea";
import { ChatSubmitButton } from "@/components/chat/chat-submit-button";

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
        textarea.style.height = "0px";
        textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
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
      className="mx-auto flex w-full max-w-4xl items-end gap-3 px-4 py-4 md:px-6 md:py-5"
    >
      <input type="hidden" name="conversationId" value={conversationId} />
      <input type="hidden" name="redirectPath" value={redirectPath} />

      <div className="flex flex-1 items-end gap-3 rounded-3xl border border-border/60 bg-card/80 px-4 py-3 shadow-sm backdrop-blur-2xl transition focus-within:border-primary/40 focus-within:shadow-[0_0_0_4px_rgba(16,185,129,0.08)]">
        <ChatTextarea
          name="content"
          placeholder={`Mensagem para ${agentName}...`}
          required
          rows={1}
          className="max-h-40 min-h-[24px] flex-1 resize-none bg-transparent px-1 py-1 text-sm text-foreground outline-none placeholder:text-muted-foreground"
          onEnterSubmit={submitCurrentForm}
        />

        <ChatSubmitButton />
      </div>
    </form>
  );
}