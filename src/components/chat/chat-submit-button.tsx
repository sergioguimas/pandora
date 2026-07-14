"use client";

import { cn } from "@/lib/utils";
import { ArrowUp } from "lucide-react";

type ChatSubmitButtonProps = {
  disabled?: boolean;
};

export function ChatSubmitButton({
  disabled = false,
}: ChatSubmitButtonProps) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground transition-colors",
        "hover:opacity-90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
      )}
    >
      <ArrowUp className="h-4 w-4" />
    </button>
  );
}
