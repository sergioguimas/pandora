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
      className="mt-3 inline-flex items-center gap-2 rounded-lg border border-amber-400/25 bg-amber-400/10 px-3 py-1.5 text-xs font-semibold text-amber-100 transition hover:bg-amber-400/20 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <RotateCcw className="h-3.5 w-3.5" />
      )}

      {loading ? "Tentando novamente..." : "Tentar novamente"}
    </button>
  );
}