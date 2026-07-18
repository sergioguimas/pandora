"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Dispara o e-mail de recuperação. O link dele deve apontar para /auth/confirm
// (configurado no template "Reset password" do Supabase). Sempre mostramos a
// mesma confirmação — não revelamos se o e-mail existe (evita enumeração).

export function RecoverForm() {
  const [email, setEmail] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    const supabase = createClient();
    // O redirect final é controlado pelo template; não revelamos erro ao usuário.
    await supabase.auth.resetPasswordForEmail(email).catch(() => {});
    setEnviando(false);
    setEnviado(true);
  }

  if (enviado) {
    return (
      <p className="mt-4 text-sm text-muted-foreground">
        Se houver uma conta com esse e-mail, enviamos um link para definir uma nova senha.
        Verifique sua caixa de entrada.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <div>
        <label htmlFor="email" className="text-sm font-medium text-foreground">
          E-mail
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="mt-1 h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
        />
      </div>
      <button
        type="submit"
        disabled={enviando}
        className="h-11 w-full rounded-md bg-primary text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {enviando ? "Enviando…" : "Enviar link de acesso"}
      </button>
    </form>
  );
}
