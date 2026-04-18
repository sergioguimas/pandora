"use client";

import { motion } from "framer-motion";

export function ChatTypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex justify-start"
    >
      <div className="rounded-3xl rounded-bl-md border border-border/60 bg-card/90 px-4 py-3 shadow-sm backdrop-blur-xl">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Digitando</span>

          <div className="flex items-center gap-1">
            <motion.span
              animate={{ y: [0, -3, 0] }}
              transition={{ repeat: Infinity, duration: 0.9, delay: 0 }}
              className="h-1.5 w-1.5 rounded-full bg-muted-foreground"
            />
            <motion.span
              animate={{ y: [0, -3, 0] }}
              transition={{ repeat: Infinity, duration: 0.9, delay: 0.15 }}
              className="h-1.5 w-1.5 rounded-full bg-muted-foreground"
            />
            <motion.span
              animate={{ y: [0, -3, 0] }}
              transition={{ repeat: Infinity, duration: 0.9, delay: 0.3 }}
              className="h-1.5 w-1.5 rounded-full bg-muted-foreground"
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}