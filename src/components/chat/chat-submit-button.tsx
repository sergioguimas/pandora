"use client";

import { Loader2, SendHorizonal } from "lucide-react";
import { useFormStatus } from "react-dom";

export function ChatSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-w-[108px] items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-[0_8px_24px_rgba(16,185,129,0.18)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Enviando
        </>
      ) : (
        <>
          <SendHorizonal className="h-4 w-4" />
          Enviar
        </>
      )}
    </button>
  );
}