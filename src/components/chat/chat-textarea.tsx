"use client";

import { useEffect, useRef } from "react";

type ChatTextareaProps = {
  name: string;
  placeholder: string;
  required?: boolean;
  rows?: number;
  className?: string;
  onEnterSubmit?: () => void;
};

export function ChatTextarea({
  name,
  placeholder,
  required,
  rows = 1,
  className,
  onEnterSubmit,
}: ChatTextareaProps) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  function resize() {
    const el = ref.current;
    if (!el) return;

    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }

  useEffect(() => {
    resize();
  }, []);

  return (
    <textarea
      ref={ref}
      name={name}
      placeholder={placeholder}
      required={required}
      rows={rows}
      onInput={resize}
      onKeyDown={(event) => {
        if (
          event.key === "Enter" &&
          !event.shiftKey &&
          !event.nativeEvent.isComposing
        ) {
          event.preventDefault();
          onEnterSubmit?.();
        }
      }}
      className={className}
    />
  );
}