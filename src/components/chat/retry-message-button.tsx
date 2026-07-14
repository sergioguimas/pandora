"use client";

import { Loader2, RotateCcw } from "lucide-react";
import { useState } from "react";

type RetryMessageButtonProps = {
  assistantMessageId: string;
  disabled?: boolean;
  onRetryMessage?: (assistantMessageId: string) => Promise<void> | void;
};

export function RetryMessageButton({
  assistantMessageId,
  disabled,
  onRetryMessage,
}: RetryMessageButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (loading || disabled || !onRetryMessage) return;

    setLoading(true);

    try {
      await onRetryMessage(assistantMessageId);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading || disabled}
      className="mt-2.5 inline-flex items-center gap-2 rounded-md border border-border bg-surface-2 px-2.5 py-1.5 font-mono text-xs font-medium text-muted-foreground transition-colors hover:bg-surface-3 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <RotateCcw className="h-3.5 w-3.5" />
      )}

      {loading ? "tentando…" : "tentar novamente"}
    </button>
  );
}