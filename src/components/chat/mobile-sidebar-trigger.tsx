"use client";

import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";

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
      className="h-10 w-10 rounded-xl md:hidden"
      aria-label="Abrir agentes"
    >
      <Menu className="h-5 w-5" />
    </Button>
  );
}