"use client";

import { useActionState, useEffect, useState } from "react";
import { Pencil, Check, X } from "lucide-react";
import { renameConversationAction } from "@/server/actions/chat-actions";

type RenameConversationFormProps = {
  conversationId: string;
  agentSlug: string;
  initialTitle: string;
  isOwner: boolean;
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
  isOwner,
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

        {isOwner ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label="Renomear conversa"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-surface-1 text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        ) : null}
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
          className="h-9 w-full rounded-md border border-input bg-surface-2 px-3 text-sm text-foreground outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20"
          maxLength={120}
          required
          autoFocus
        />
        {state.error ? (
          <p className="mt-1 text-xs text-destructive">{state.error}</p>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={pending}
        aria-label="Salvar"
        className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground transition-colors hover:opacity-90 disabled:opacity-60"
      >
        <Check className="h-4 w-4" />
      </button>

      <button
        type="button"
        onClick={() => {
          setTitle(initialTitle);
          setEditing(false);
        }}
        aria-label="Cancelar"
        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-surface-1 text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </form>
  );
}