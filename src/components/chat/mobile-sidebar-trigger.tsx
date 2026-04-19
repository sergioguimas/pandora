"use client";

import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type MobileSidebarTriggerProps = {
  onClick: () => void;
};

export function MobileSidebarTrigger({
  onClick,
}: MobileSidebarTriggerProps) {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={onClick}
      className={cn(
        "h-11 w-11 rounded-2xl border border-white/10 bg-[#020817]/80 text-white shadow-lg backdrop-blur-xl transition",
        "hover:bg-white/10 hover:text-white active:scale-95 md:hidden"
      )}
      aria-label="Abrir agentes"
    >
      <Menu className="h-5 w-5" />
    </Button>
  );
}