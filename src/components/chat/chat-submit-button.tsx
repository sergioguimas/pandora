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
        "flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-all duration-200",
        "hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
      )}
    >
      <ArrowUp className="h-4 w-4" />
    </button>
  );
}