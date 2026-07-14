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
        "h-10 w-10 rounded-md border border-border bg-surface-1 text-foreground shadow-sm transition-colors",
        "hover:bg-surface-2 active:scale-95 md:hidden"
      )}
      aria-label="Abrir agentes"
    >
      <Menu className="h-5 w-5" />
    </Button>
  );
}