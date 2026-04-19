"use client";

import { useRef } from "react";
import { Plus } from "lucide-react";
import { createConversationAction } from "@/server/actions/chat-actions";

type CreateConversationButtonProps = {
  agentSlug: string;
};

export function CreateConversationButton({
  agentSlug,
}: CreateConversationButtonProps) {
  const formRef = useRef<HTMLFormElement | null>(null);

  return (
    <form ref={formRef} action={createConversationAction}>
      <input type="hidden" name="agentSlug" value={agentSlug} />
      <input type="hidden" name="title" value="" />

      <button
        type="submit"
        className="inline-flex items-center gap-2 rounded-xl border border-border/60 bg-card/60 px-3 py-2 text-sm font-medium text-foreground transition hover:bg-accent"
      >
        <Plus className="h-4 w-4" />
        Nova conversa
      </button>
    </form>
  );
}