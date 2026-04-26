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
        "flex h-10 w-10 items-center justify-center rounded-lg bg-white text-[#020817] shadow-lg transition-all duration-200",
        "hover:bg-white/90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
      )}
    >
      <ArrowUp className="h-4 w-4" />
    </button>
  );
}
