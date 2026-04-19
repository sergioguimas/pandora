"use client";

import { useActionState, useEffect, useState } from "react";
import { Pencil, Check, X } from "lucide-react";
import { renameConversationAction } from "@/server/actions/chat-actions";

type RenameConversationFormProps = {
  conversationId: string;
  agentSlug: string;
  initialTitle: string;
};

type RenameState = {
  success: boolean;
  error: string | null;
};

const initialState: RenameState = {
  success: false,
  error: null,
};

async function renameConversationActionStateful(
  _prevState: RenameState,
  formData: FormData
): Promise<RenameState> {
  try {
    await renameConversationAction(formData);
    return { success: true, error: null };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro ao renomear conversa.",
    };
  }
}

export function RenameConversationForm({
  conversationId,
  agentSlug,
  initialTitle,
}: RenameConversationFormProps) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(initialTitle);

  const [state, formAction, pending] = useActionState(
    renameConversationActionStateful,
    initialState
  );

  useEffect(() => {
    if (state.success) {
      setEditing(false);
    }
  }, [state.success]);

  useEffect(() => {
    setTitle(initialTitle);
  }, [initialTitle]);

  if (!editing) {
    return (
      <div className="flex items-center gap-2">
        <h1 className="truncate text-base font-semibold text-foreground md:text-lg">
          {initialTitle}
        </h1>

        <button
          type="button"
          onClick={() => setEditing(true)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 bg-card text-muted-foreground transition hover:bg-accent hover:text-foreground"
        >
          <Pencil className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex w-full max-w-xl items-start gap-2">
      <input type="hidden" name="conversationId" value={conversationId} />
      <input type="hidden" name="agentSlug" value={agentSlug} />

      <div className="flex-1">
        <input
          name="title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Nome da conversa"
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary"
          maxLength={120}
          required
        />
        {state.error ? (
          <p className="mt-1 text-xs text-red-500">{state.error}</p>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 transition hover:bg-emerald-500/15 disabled:opacity-60"
      >
        <Check className="h-4 w-4" />
      </button>

      <button
        type="button"
        onClick={() => {
          setTitle(initialTitle);
          setEditing(false);
        }}
        className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border/60 bg-card text-muted-foreground transition hover:bg-accent hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </form>
  );
}