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
        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-white px-3 text-sm font-semibold text-[#020817] transition hover:bg-white/90"
      >
        <Plus className="h-4 w-4" />
        Nova
      </button>
    </form>
  );
}
