"use client";

import Link from "next/link";
import { signOut } from "@/server/actions/auth-actions";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Settings, LogOut, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";

export function ChatHeaderActions() {
  return (
    <div className="flex items-center gap-3">
      <div className="h-6 w-[1px] bg-border/60 mx-1" /> {/* Divisor Vertical */}

      {/* Toggle de Tema */}
      <div className="hover:scale-110 transition-transform">
        <ThemeToggle />
      </div>

      {/* Botão de Sair - Estilo Destrutivo Suave */}
      <form action={signOut}>
        <button 
          className={cn(
            "group flex items-center gap-2 rounded-xl border border-border/40 bg-card/40 px-4 py-2",
            "text-sm font-bold text-muted-foreground backdrop-blur-md transition-all",
            "hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/20 active:scale-95"
          )}
          title="Sair da conta"
        >
          <LogOut className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          <span className="hidden sm:inline">Sair</span>
        </button>
      </form>
    </div>
  );
}