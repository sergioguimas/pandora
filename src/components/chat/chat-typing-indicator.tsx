"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type ChatTypingIndicatorProps = {
  inline?: boolean;
  label?: string;
};

const dotVariants = {
  initial: { y: 0, opacity: 0.45 },
  animate: { y: [-1, -7, 0], opacity: [0.45, 1, 0.45] },
};

export function ChatTypingIndicator({
  inline = false,
  label = "Digitando...",
}: ChatTypingIndicatorProps) {
  return (
    <div className={cn(inline ? "flex items-center" : "flex w-full justify-start")}>
      <div
        className={cn(
          "flex items-center gap-2 rounded-lg rounded-tl-sm border border-border bg-bubble-agent px-3.5 py-2.5",
          inline && "border-0 bg-transparent p-0"
        )}
      >
        <span className="font-mono text-xs text-muted-foreground">{label}</span>

        <div className="flex items-center gap-1">
          {[0, 1, 2].map((index) => (
            <motion.span
              key={index}
              variants={dotVariants}
              initial="initial"
              animate="animate"
              transition={{
                duration: 0.9,
                repeat: Infinity,
                ease: "easeInOut",
                delay: index * 0.15,
              }}
              className="h-1.5 w-1.5 rounded-full bg-muted-foreground"
            />
          ))}
        </div>
      </div>
    </div>
  );
}