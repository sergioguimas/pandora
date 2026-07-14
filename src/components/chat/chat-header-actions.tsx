"use client";

import Link from "next/link";
import { signOut } from "@/server/actions/auth-actions";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Settings, LogOut, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";

export function ChatHeaderActions() {
  return (
    <div className="flex items-center gap-2">
      <div className="mx-1 h-6 w-px bg-border" />

      <ThemeToggle />

      <form action={signOut}>
        <button
          className={cn(
            "group flex items-center gap-2 rounded-md border border-border bg-surface-1 px-3 py-1.5",
            "text-sm font-medium text-muted-foreground transition-colors",
            "hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive active:scale-95"
          )}
          title="Sair da conta"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Sair</span>
        </button>
      </form>
    </div>
  );
}